"""FxZone API - application factory."""
from __future__ import annotations

import asyncio
import logging
from contextlib import asynccontextmanager

import httpx
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from .cache import Cache
from .config import Settings, get_settings
from .db import Database
from .errors import install_error_handlers
from .logging_conf import configure_logging
from .middleware import RequestContextMiddleware
from .realtime import RealtimePublisher
from .routers import auth, chat, health, insights, market, notifications, sessions, social
from .security import TokenVerifier
from .services.ai import AiService
from .services.market.catalog import CATALOG
from .services.market.service import MarketService
from .services.news import NewsService
from .services.notifications import Notifier
from .services.storage import StorageService
from .services.supabase_admin import SupabaseAdmin
from . import tasks

log = logging.getLogger("fxzone")


async def sync_assets(db: Database) -> None:
    """Keep public.assets in step with the in-code catalogue (idempotent upsert)."""
    async with db.transaction() as conn:
        await conn.executemany(
            """INSERT INTO assets (symbol, name, asset_type, description, is_active)
               VALUES ($1,$2,$3::asset_type,$4,true)
               ON CONFLICT (symbol) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description""",
            [(a.symbol, a.name, a.asset_type, a.description) for a in CATALOG])


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or get_settings()
    configure_logging(settings.log_level, json_output=settings.is_production)

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        http = httpx.AsyncClient(limits=httpx.Limits(max_connections=50, max_keepalive_connections=20),
                                 follow_redirects=False)
        db, cache = Database(), Cache(settings)
        await db.connect(settings)
        await cache.connect()
        realtime = RealtimePublisher(settings, http)
        market_svc = MarketService(settings, http, cache)

        app.state.settings, app.state.http, app.state.db, app.state.cache = settings, http, db, cache
        app.state.realtime = realtime
        app.state.verifier = TokenVerifier(settings)
        app.state.market = market_svc
        app.state.ai = AiService(settings, http, cache, market_svc)
        app.state.storage = StorageService(settings, http)
        app.state.notifier = Notifier(db, realtime)
        app.state.supabase_admin = SupabaseAdmin(settings, http)
        app.state.news = NewsService(db, http, realtime, settings.news_feed_list)

        if settings.asset_sync_on_startup:
            await sync_assets(db)

        jobs: list[asyncio.Task] = []
        if settings.enable_background_tasks:
            jobs = [asyncio.create_task(tasks.market_loop(market_svc, realtime, cache, settings.market_refresh_seconds), name="market"),
                    asyncio.create_task(tasks.housekeeping_loop(db, cache), name="housekeeping")]
            if settings.news_feed_list:
                jobs.append(asyncio.create_task(tasks.news_loop(app.state.news, cache, settings.news_refresh_seconds), name="news"))
        log.info("FxZone API ready (env=%s, realtime=%s, gemini=%s, state=%s)", settings.environment,
                 realtime.enabled, app.state.ai.gemini_enabled, cache.backend)
        try:
            yield
        finally:
            for j in jobs:
                j.cancel()
            await asyncio.gather(*jobs, return_exceptions=True)
            await realtime.drain()
            await http.aclose()
            await cache.close()
            await db.close()

    app = FastAPI(title="FxZone API", version="1.0.0", lifespan=lifespan,
                  docs_url=None if settings.is_production else "/docs",
                  redoc_url=None, openapi_url=None if settings.is_production else "/openapi.json")

    app.add_middleware(CORSMiddleware, allow_origins=settings.cors_origin_list, allow_credentials=False,
                       allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
                       allow_headers=["Authorization", "Content-Type", "X-Request-ID"],
                       expose_headers=["X-Request-ID", "X-RateLimit-Limit", "X-RateLimit-Remaining", "Retry-After"],
                       max_age=600)
    app.add_middleware(RequestContextMiddleware, max_json_bytes=settings.max_json_body_bytes,
                       max_upload_bytes=settings.max_upload_bytes, hsts=settings.is_production)
    install_error_handlers(app)

    for r in (health.router, auth.router, social.router, chat.router, sessions.router, notifications.router,
              market.router, insights.news_router, insights.ai_router):
        app.include_router(r)

    if settings.storage_backend == "local":  # dev/test only (production validation forbids it)
        import os
        os.makedirs(settings.upload_dir, exist_ok=True)
        app.mount("/uploads", StaticFiles(directory=settings.upload_dir), name="uploads")
    return app


app = create_app if False else None  # `uvicorn app.main:create_app --factory`
