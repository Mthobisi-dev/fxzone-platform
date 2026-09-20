"""Quote + candle service with caching, single-flight upstream calls and honest staleness."""
from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timezone
from typing import Any

import httpx

from ...cache import Cache, SingleFlight
from ...config import Settings
from ...errors import NotFound, UpstreamUnavailable
from . import providers
from .catalog import BY_SYMBOL, CATALOG, AssetDef, resolve_asset

log = logging.getLogger("fxzone.market")

QUOTES_KEY = "market:quotes"
ATTEMPT_TTL = 15  # seconds between inline (non-background) refresh attempts
# timeframe -> (yahoo interval, yahoo range, aggregate-to-seconds or None, cache ttl seconds)
TIMEFRAMES: dict[str, tuple[str, str, int | None, int]] = {
    "1m": ("1m", "1d", None, 30),
    "5m": ("5m", "5d", None, 60),
    "15m": ("15m", "5d", None, 60),
    "1h": ("60m", "1mo", None, 300),
    "4h": ("60m", "3mo", 4 * 3600, 300),
    "1d": ("1d", "1y", None, 900),
}


def aggregate_bars(bars: list[dict[str, Any]], bucket_seconds: int) -> list[dict[str, Any]]:
    buckets: dict[int, dict[str, Any]] = {}
    for b in bars:
        key = b["time"] - b["time"] % bucket_seconds
        cur = buckets.get(key)
        if cur is None:
            buckets[key] = {"time": key, "open": b["open"], "high": b["high"], "low": b["low"],
                            "close": b["close"], "volume": b["volume"]}
        else:
            cur["high"] = max(cur["high"], b["high"])
            cur["low"] = min(cur["low"], b["low"])
            cur["close"] = b["close"]
            cur["volume"] += b["volume"]
    return [buckets[k] for k in sorted(buckets)]


def _age_seconds(iso: str) -> float:
    try:
        return (datetime.now(timezone.utc) - datetime.fromisoformat(iso)).total_seconds()
    except ValueError:
        return 1e9


class MarketService:
    def __init__(self, settings: Settings, http: httpx.AsyncClient, cache: Cache) -> None:
        self.s, self.http, self.cache = settings, http, cache
        self.flight = SingleFlight()
        self._cg_key: str | None = None

    # ── quotes ─────────────────────────────────────────────────────────────
    def _decorate(self, q: dict[str, Any]) -> dict[str, Any]:
        """API shape. `bid`/`ask` are null: our providers do not supply them and we do not invent a spread."""
        age = _age_seconds(q["fetched_at"])
        return {
            "symbol": q["symbol"], "price": q["price"], "change": q["change"],
            "change_pct": q["change_pct"], "change_percent": q["change_pct"],
            "open": q["open"], "high": q["high"], "low": q["low"], "volume": q["volume"],
            "bid": None, "ask": None,
            "timestamp": q["fetched_at"], "data_source": q["source"],
            "is_stale": age > self.s.market_stale_after_seconds,
        }

    async def _load(self) -> dict[str, dict[str, Any]]:
        return await self.cache.get_json(QUOTES_KEY) or {}

    async def refresh(self, which: str = "all") -> dict[str, dict[str, Any]]:
        """Fetch from providers and merge into the cache. A failed symbol keeps its previous (aging) quote."""
        async def work() -> dict[str, dict[str, Any]]:
            merged = await self._load()
            fresh: dict[str, providers.Quote] = {}
            if which in ("all", "crypto"):
                try:
                    fresh.update(await providers.fetch_coingecko(self.http, self._cg_key))
                except (httpx.HTTPError, ValueError) as e:
                    log.warning("coingecko refresh failed: %s", e)
            if which in ("all", "traditional"):
                trad = [a for a in CATALOG if not a.coingecko]
                fresh.update(await providers.fetch_yahoo_quotes(self.http, trad))
            for sym, q in fresh.items():
                merged[sym] = q.as_dict()
            if fresh:
                await self.cache.set_json(QUOTES_KEY, merged, ttl=7 * 86400)
            log.info("market refresh %s: %d/%d symbols updated", which, len(fresh), len(CATALOG))
            return merged

        return await self.flight.run(f"refresh:{which}", work)

    def _needs_refresh(self, stored: dict[str, dict[str, Any]], needed: list[str]) -> bool:
        if any(s not in stored for s in needed):
            return True
        freshest = min((_age_seconds(stored[s]["fetched_at"]) for s in needed), default=1e9)
        return freshest > max(self.s.market_refresh_seconds * 6, 90)

    async def _inline_refresh(self, needed: list[str]) -> dict[str, dict[str, Any]]:
        """Cold/dead-cache path. The background job normally keeps quotes warm; this only runs when it has not.
        Bounded: at most one attempt per ATTEMPT_TTL cluster-wide, even if a provider is permanently failing."""
        stored = await self._load()
        if not self._needs_refresh(stored, needed):
            return stored
        if await self.cache.get_json("market:attempt"):
            return stored  # someone tried very recently; serve what we have (possibly empty/stale)
        lock = await self.cache.acquire_lock("market-inline-refresh", ttl=20)
        if lock:
            try:
                await self.cache.set_json("market:attempt", 1, ATTEMPT_TTL)
                return await self.refresh("all")
            finally:
                await self.cache.release_lock("market-inline-refresh", lock)
        for _ in range(20):  # another instance is refreshing: wait (<= 5s) for its result instead of returning nothing
            await asyncio.sleep(0.25)
            stored = await self._load()
            if not self._needs_refresh(stored, needed):
                break
        return stored

    async def get_quotes(self, symbols: list[str] | None = None) -> dict[str, dict[str, Any]]:
        needed = [s for s in (symbols or BY_SYMBOL) if s in BY_SYMBOL]
        stored = await self._load()
        if self._needs_refresh(stored, needed):
            # in-process single-flight: N concurrent requests share ONE refresh and all receive its result
            stored = await self.flight.run("inline-refresh", lambda: self._inline_refresh(needed))
        return {s: self._decorate(stored[s]) for s in needed if s in stored}

    # ── candles ────────────────────────────────────────────────────────────
    async def get_history(self, symbol: str, timeframe: str = "1h", limit: int = 300) -> list[dict[str, Any]]:
        asset = resolve_asset(symbol)
        if not asset:
            raise NotFound(f"Unknown symbol '{symbol}'")
        if timeframe not in TIMEFRAMES:
            raise NotFound(f"Unsupported timeframe '{timeframe}'. Use one of: {', '.join(TIMEFRAMES)}")
        interval, range_, agg, ttl = TIMEFRAMES[timeframe]
        key = f"market:hist:{asset.symbol}:{timeframe}"
        bars = await self.cache.get_json(key)
        if bars is None:
            async def work() -> list[dict[str, Any]]:
                parsed = await providers.fetch_yahoo_chart(self.http, asset.yahoo, interval, range_)
                b = aggregate_bars(parsed["bars"], agg) if agg else parsed["bars"]
                if not b:
                    raise ValueError("no candles returned")
                return b
            try:
                bars = await self.flight.run(key, work)
                await self.cache.set_json(key, bars, ttl)
                await self.cache.set_json(key + ":stale", bars, 86400)
            except (httpx.HTTPError, ValueError) as e:
                log.warning("history fetch failed for %s/%s: %s", asset.symbol, timeframe, e)
                bars = await self.cache.get_json(key + ":stale")  # stale-if-error (real data, just older)
                if bars is None:
                    raise UpstreamUnavailable("Market data provider unavailable; please try again shortly") from None
        return bars[-max(1, min(limit, 2000)):]

    async def asset_name(self, symbol: str) -> str:
        a = BY_SYMBOL.get(symbol)
        return a.name if a else symbol
