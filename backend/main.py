"""FxZone Backend Application - Main FastAPI Entry Point."""
import asyncio
import sys
import logging

# Ensure Windows stdout/stderr use UTF-8 to prevent charmap encoding crashes
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
if hasattr(sys.stderr, 'reconfigure'):
    sys.stderr.reconfigure(encoding='utf-8', errors='replace')

from contextlib import asynccontextmanager
from fastapi import FastAPI, WebSocket, status
from fastapi.middleware.cors import CORSMiddleware

from config import settings
from shared.database import init_all_databases, close_all_databases, get_mongodb
from shared.middleware import RateLimitMiddleware, RequestLoggingMiddleware

# Import Routers
from services.auth.router import router as auth_router
from services.market_data.router import router as market_router
from services.ai_assistant.router import router as ai_router
from services.news.router import router as news_router
from services.social.router import router as social_router
from services.chat.router import router as chat_router
from services.chat.websocket import router as chat_ws_router
from services.live_sessions.router import router as live_router
from services.live_sessions.signaling import router as live_sig_router
from services.notifications.router import router as notif_router
from services.ml_personalization.router import router as ml_router

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifecycle events to manage database connection pools on startup/shutdown."""
    logger.info("Initializing FxZone database connections (Postgres, Redis, MongoDB)...")
    await init_all_databases()

    from shared.database import get_mongodb
    mongo_db = get_mongodb()

    # ── News seeding: ONLY seed if using real MongoDB (Motor), never seed MockMongoDB ──
    # MockMongoDB is in-memory — it loses all data on every restart. Seeding it on
    # every cold start creates duplicate articles and gives the appearance of
    # "old data being restored" when in fact it's just re-inserted each time.
    try:
        if mongo_db is not None and "Mock" not in type(mongo_db).__name__:
            from services.news.ingester import NewsIngester
            ingester = NewsIngester(mongo_db)
            count = await ingester.ingest_demo_data()
            logger.info(f"MongoDB news verified/seeded ({count} new articles).")
        else:
            logger.info("MockMongoDB active — skipping news seed (no persistent MongoDB configured).")
    except Exception as e:
        logger.error(f"News seeding error on startup: {e}")

    # ── FxZone Bot poster — weekly cadence, safe to start every boot ──
    try:
        from services.ai_assistant.bot_poster import start_bot_poster
        asyncio.create_task(start_bot_poster())
        logger.info("FxZone Bot background market update service started.")
    except Exception as e:
        logger.error(f"Failed to launch FxZone Bot poster: {e}")

    # ── Self-ping keep-alive: prevent Render free-tier spin-down ──
    # Render free tier sleeps after 15 min of inactivity — when it wakes up,
    # the process restarts and ALL in-memory data is lost (MockRedis, MockMongoDB).
    # This pinger keeps the service awake 24/7 by hitting /health every 10 minutes.
    async def _self_ping():
        import os
        import httpx
        render_url = os.environ.get("RENDER_EXTERNAL_URL", "")
        if not render_url:
            # Try to derive from Render environment
            service_name = os.environ.get("RENDER_SERVICE_NAME", "")
            if service_name:
                render_url = f"https://{service_name}.onrender.com"
        if render_url:
            logger.info(f"Self-ping keep-alive enabled: hitting {render_url}/health every 10 min")
            while True:
                await asyncio.sleep(600)  # every 10 minutes
                try:
                    async with httpx.AsyncClient(timeout=10.0) as client:
                        resp = await client.get(f"{render_url}/health")
                        logger.debug(f"Self-ping: {resp.status_code}")
                except Exception as e:
                    logger.debug(f"Self-ping skipped: {e}")
        else:
            logger.info("RENDER_EXTERNAL_URL not set — self-ping keep-alive disabled (local dev mode).")

    asyncio.create_task(_self_ping())

    logger.info("FxZone Backend is LIVE and fully operational.")
    yield

    logger.info("Shutting down FxZone database connections...")
    await close_all_databases()
    logger.info("FxZone Backend shutdown complete.")


app = FastAPI(
    title="FxZone API",
    description="AI-Powered Trading Intelligence Platform API Gateway.",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS Configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Custom Middlewares
app.add_middleware(RequestLoggingMiddleware)
app.add_middleware(RateLimitMiddleware)

from fastapi.staticfiles import StaticFiles
import os

# REST and Router Mounts
# Create uploads directory if it does not exist
os.makedirs("uploads", exist_ok=True)
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

app.include_router(auth_router)
app.include_router(market_router)
app.include_router(ai_router)
app.include_router(news_router)
app.include_router(social_router)
app.include_router(chat_router)
app.include_router(chat_ws_router)
app.include_router(live_router)
app.include_router(live_sig_router)
app.include_router(notif_router)
app.include_router(ml_router)


# Health check endpoint
@app.get("/health", tags=["System"])
async def health_check():
    """Simple check to verify API service health."""
    return {
        "status": "healthy",
        "app": "FxZone",
        "version": "1.0.0"
    }


@app.get("/", tags=["System"])
async def root():
    """Welcome route returning API status info."""
    return {
        "message": "Welcome to the FxZone Backend API Gateway",
        "health": "/health",
        "docs": "/docs"
    }


# Standalone Market Data WebSocket Endpoint
@app.websocket("/ws/market")
async def market_websocket(websocket: WebSocket):
    """Real-time price feed updates WebSocket endpoint."""
    from services.market_data.websocket import market_websocket_handler
    await market_websocket_handler(websocket)
