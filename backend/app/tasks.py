"""Background jobs. Each job runs on ONE instance at a time (Redis lock) so scaling out does not multiply upstream calls."""
from __future__ import annotations

import asyncio
import logging
import secrets

from fastapi.encoders import jsonable_encoder

from .cache import Cache
from .realtime import MARKET_TOPIC, RealtimePublisher
from .services.market.service import MarketService
from .services.news import NewsService
from .db import Database

log = logging.getLogger("fxzone.tasks")


async def _leader_loop(name: str, cache: Cache, interval: float, job) -> None:
    token = secrets.token_hex(8)
    ttl = int(interval * 2 + 10)
    while True:
        try:
            if await cache.acquire_lock(name, ttl, token):
                await job()
        except asyncio.CancelledError:
            await cache.release_lock(name, token)
            raise
        except Exception:  # noqa: BLE001 - a failing tick must never kill the loop
            log.exception("background job %s failed", name)
        await asyncio.sleep(interval)


async def market_loop(market: MarketService, realtime: RealtimePublisher, cache: Cache, interval: int) -> None:
    tick = 0

    async def job() -> None:
        nonlocal tick
        # crypto every tick; stocks/forex/commodities (one upstream call per symbol) every 4th tick
        quotes = await market.refresh("all" if tick % 4 == 0 else "crypto")
        tick += 1
        if quotes:
            data = {s: market._decorate(q) for s, q in quotes.items()}
            realtime.publish_nowait(MARKET_TOPIC, "prices", {"data": jsonable_encoder(data)})

    await _leader_loop("market-refresh", cache, interval, job)


async def news_loop(news: NewsService, cache: Cache, interval: int) -> None:
    async def job() -> None:
        n = await news.ingest_once()
        await news.cleanup()
        log.info("news ingest: %d new articles", n)

    await _leader_loop("news-ingest", cache, interval, job)


async def housekeeping_loop(db: Database, cache: Cache) -> None:
    async def job() -> None:
        await db.execute("DELETE FROM posts WHERE is_story AND expires_at IS NOT NULL AND expires_at < NOW() - INTERVAL '1 day'")
        # sessions abandoned without an explicit end (browser closed, crash): close after 12h live
        await db.execute("""UPDATE live_sessions SET status = 'ended', ended_at = NOW(), viewer_count = 0
                            WHERE status = 'live' AND started_at < NOW() - INTERVAL '12 hours'""")

    await _leader_loop("housekeeping", cache, 3600, job)
