"""Upstream market-data providers.

NOTE: both are free, unofficial/public endpoints without an SLA and with usage terms of their own.
They are fine for a demo/community product; for a commercial trading product swap in a licensed
data vendor by implementing the same two coroutines.
"""
from __future__ import annotations

import asyncio
import logging
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from typing import Any

from urllib.parse import quote

import httpx

from .catalog import CATALOG, AssetDef

log = logging.getLogger("fxzone.market.providers")

UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) "
      "Chrome/124.0 Safari/537.36")
COINGECKO_URL = "https://api.coingecko.com/api/v3/simple/price"
YAHOO_CHART_URL = "https://query1.finance.yahoo.com/v8/finance/chart/{symbol}"  # symbol is percent-encoded by the caller


@dataclass(slots=True)
class Quote:
    symbol: str
    price: float
    change: float
    change_pct: float
    open: float
    high: float
    low: float
    volume: float
    source: str
    fetched_at: str  # ISO-8601 UTC; when WE obtained it

    def as_dict(self) -> dict[str, Any]:
        return asdict(self)


def _decimals(price: float) -> int:
    if price >= 100:
        return 2
    if price >= 1:
        return 4
    return 6


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _num(v: Any) -> float | None:
    try:
        f = float(v)
        return f if f == f and f not in (float("inf"), float("-inf")) else None
    except (TypeError, ValueError):
        return None


async def fetch_coingecko(http: httpx.AsyncClient, api_key: str | None = None) -> dict[str, Quote]:
    assets = [a for a in CATALOG if a.coingecko]
    params = {"ids": ",".join(a.coingecko for a in assets), "vs_currencies": "usd",
              "include_24hr_change": "true", "include_24hr_vol": "true"}
    headers = {"User-Agent": "FxZonePlatform/1.0", "Accept": "application/json"}
    if api_key:
        headers["x-cg-demo-api-key"] = api_key
    r = await http.get(COINGECKO_URL, params=params, headers=headers, timeout=10)
    r.raise_for_status()
    data = r.json()
    out: dict[str, Quote] = {}
    ts = _now()
    for a in assets:
        item = data.get(a.coingecko or "")
        price = _num(item.get("usd")) if item else None
        if not price or price <= 0:
            continue
        pct = _num(item.get("usd_24h_change")) or 0.0
        prev = price / (1 + pct / 100) if pct > -100 else price
        d = _decimals(price)
        out[a.symbol] = Quote(
            symbol=a.symbol, price=round(price, d), change=round(price - prev, d), change_pct=round(pct, 2),
            open=round(prev, d), high=round(price, d), low=round(price, d),  # CoinGecko simple/price has no day range
            volume=round(_num(item.get("usd_24h_vol")) or 0), source="coingecko", fetched_at=ts)
    return out


def parse_yahoo_chart(payload: dict[str, Any]) -> dict[str, Any]:
    """Return {'meta': {...}, 'bars': [{'time','open','high','low','close','volume'}...]}; raises ValueError if unusable."""
    chart = payload.get("chart") or {}
    if chart.get("error"):
        raise ValueError(f"yahoo error: {chart['error'].get('description') or chart['error']}")
    results = chart.get("result") or []
    if not results:
        raise ValueError("yahoo returned no result")
    res = results[0]
    stamps = res.get("timestamp") or []
    quote = ((res.get("indicators") or {}).get("quote") or [{}])[0]
    bars: list[dict[str, Any]] = []
    for i, t in enumerate(stamps):
        o, h, l, c = (_num((quote.get(k) or [None] * len(stamps))[i]) for k in ("open", "high", "low", "close"))
        if None in (o, h, l, c):
            continue  # yahoo emits nulls for missing sessions
        v = _num((quote.get("volume") or [0] * len(stamps))[i]) or 0.0
        bars.append({"time": int(t), "open": o, "high": h, "low": l, "close": c, "volume": v})
    return {"meta": res.get("meta") or {}, "bars": bars}


async def fetch_yahoo_chart(http: httpx.AsyncClient, yahoo_symbol: str, interval: str, range_: str) -> dict[str, Any]:
    r = await http.get(YAHOO_CHART_URL.format(symbol=quote(yahoo_symbol, safe="")), params={"interval": interval, "range": range_},
                       headers={"User-Agent": UA, "Accept": "application/json"}, timeout=10)
    r.raise_for_status()
    return parse_yahoo_chart(r.json())


async def fetch_yahoo_quote(http: httpx.AsyncClient, asset: AssetDef) -> Quote | None:
    parsed = await fetch_yahoo_chart(http, asset.yahoo, "1d", "5d")
    meta, bars = parsed["meta"], parsed["bars"]
    price = _num(meta.get("regularMarketPrice")) or (bars[-1]["close"] if bars else None)
    if not price or price <= 0:
        return None
    prev = _num(meta.get("chartPreviousClose")) or _num(meta.get("previousClose"))
    if prev is None and len(bars) >= 2:
        prev = bars[-2]["close"]
    prev = prev or price
    today = bars[-1] if bars else {}
    d = _decimals(price)
    change = price - prev
    return Quote(
        symbol=asset.symbol, price=round(price, d), change=round(change, d),
        change_pct=round(change / prev * 100, 2) if prev else 0.0,
        open=round(_num(today.get("open")) or prev, d),
        high=round(_num(meta.get("regularMarketDayHigh")) or _num(today.get("high")) or price, d),
        low=round(_num(meta.get("regularMarketDayLow")) or _num(today.get("low")) or price, d),
        volume=round(_num(meta.get("regularMarketVolume")) or _num(today.get("volume")) or 0),
        source="yahoo_finance", fetched_at=_now())


async def fetch_yahoo_quotes(http: httpx.AsyncClient, assets: list[AssetDef], concurrency: int = 6) -> dict[str, Quote]:
    sem = asyncio.Semaphore(concurrency)
    out: dict[str, Quote] = {}

    async def one(a: AssetDef) -> None:
        async with sem:
            try:
                q = await fetch_yahoo_quote(http, a)
                if q:
                    out[a.symbol] = q
            except (httpx.HTTPError, ValueError) as e:
                log.warning("yahoo quote failed for %s: %s", a.symbol, e)

    await asyncio.gather(*(one(a) for a in assets))
    return out
