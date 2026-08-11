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
    
    # Seed news articles into MongoDB if none exist
    try:
        mongo_db = get_mongodb()
        if mongo_db is not None:
            from services.news.ingester import NewsIngester
            ingester = NewsIngester(mongo_db)
            await ingester.ingest_demo_data()
            logger.info("MongoDB news articles verified/seeded successfully.")
    except Exception as e:
        logger.error(f"Error seeding MongoDB demo news on startup: {e}")

    # Launch FxZone Bot periodic AI market update poster
    try:
        from services.ai_assistant.bot_poster import start_bot_poster
        asyncio.create_task(start_bot_poster())
        logger.info("FxZone Bot AI background market update service started.")
    except Exception as e:
        logger.error(f"Failed to launch FxZone Bot poster: {e}")

    logger.info("FxZone Backend services started successfully.")
    yield
    
    logger.info("Shutting down FxZone database connections...")
    await close_all_databases()
    logger.info("FxZone Backend shutdown completed.")


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
