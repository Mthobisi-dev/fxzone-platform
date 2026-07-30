"""FastAPI router for news intelligence service."""
from fastapi import APIRouter, Depends, HTTPException, Query, status
from typing import List, Optional, Dict, Any

from shared.database import get_mongodb
from shared.security import get_current_user
from shared.models import User
from services.news.service import NewsService
from services.news.ingester import NewsIngester

router = APIRouter(prefix="/api/news", tags=["News Intelligence"])


@router.get("/feed", response_model=List[Dict[str, Any]])
async def get_news_feed(
    category: Optional[str] = Query(None, description="Category filter (e.g. crypto, forex, stocks)"),
    limit: int = Query(15, ge=1, le=100),
    offset: int = Query(0, ge=0),
    current_user: User = Depends(get_current_user),
    mongo_db = Depends(get_mongodb)
):
    """Retrieve personalized news feed filtered by category, ordered by published time."""
    service = NewsService(mongo_db)
    return await service.get_news_feed(category=category, limit=limit, offset=offset)


@router.get("/breaking", response_model=List[Dict[str, Any]])
async def get_breaking_news(
    limit: int = Query(5, ge=1, le=20),
    current_user: User = Depends(get_current_user),
    mongo_db = Depends(get_mongodb)
):
    """Retrieve real-time breaking news updates with extreme sentiment levels or tags."""
    service = NewsService(mongo_db)
    return await service.get_breaking_news(limit=limit)


@router.get("/asset/{symbol}", response_model=List[Dict[str, Any]])
async def get_asset_news(
    symbol: str,
    limit: int = Query(10, ge=1, le=50),
    current_user: User = Depends(get_current_user),
    mongo_db = Depends(get_mongodb)
):
    """Retrieve news articles containing tags corresponding to a specific asset."""
    service = NewsService(mongo_db)
    return await service.get_asset_news(symbol=symbol.upper(), limit=limit)


@router.get("/search", response_model=List[Dict[str, Any]])
async def search_news(
    q: str = Query(..., min_length=2, description="Search query keywords"),
    limit: int = Query(10, ge=1, le=50),
    current_user: User = Depends(get_current_user),
    mongo_db = Depends(get_mongodb)
):
    """Search the news archive for titles or text matching the search term."""
    service = NewsService(mongo_db)
    return await service.search_news(search_query=q, limit=limit)


@router.post("/poll", status_code=status.HTTP_200_OK)
async def trigger_news_polling(
    current_user: User = Depends(get_current_user),
    mongo_db = Depends(get_mongodb)
):
    """Admin-only (or general for testing) endpoint to trigger active news ingestion/seeding."""
    ingester = NewsIngester(mongo_db)
    # Seed demo data first if empty
    seeded = await ingester.ingest_demo_data()
    # Trigger a poll to fetch a random new article
    await ingester.poll_news_feeds()
    
    return {
        "status": "success",
        "message": f"News ingestion process completed. Demo articles seeded: {seeded}"
    }
