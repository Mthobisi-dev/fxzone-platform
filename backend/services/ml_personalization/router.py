"""FastAPI router for FxZone ML Personalization service."""
from fastapi import APIRouter, Depends, HTTPException, Query, status
from typing import List, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession

from shared.database import get_db, get_mongodb
from shared.security import get_current_user
from shared.models import User
from services.ml_personalization.tracker import track_event
from services.ml_personalization.engine import MLRecommendationEngine
from services.ml_personalization.service import MLPersonalizationService
from services.ml_personalization.schemas import (
    BehaviorEventCreate,
    PreferenceVectorResponse
)
from services.market_data.schemas import AssetResponse

router = APIRouter(prefix="/api/ml", tags=["ML Personalization"])


@router.get("/preferences", response_model=PreferenceVectorResponse)
async def get_user_preferences(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Retrieve the user's current compiled interest preference vector and experience levels."""
    service = MLPersonalizationService(db)
    pref = await service.get_user_vector(user_id=current_user.id)
    return pref


@router.post("/track", status_code=status.HTTP_202_ACCEPTED)
async def track_behavior_event(
    request: BehaviorEventCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Log a user click or view event, triggering background recalculation of interest vectors."""
    # 1. Save behavior event
    await track_event(db, user_id=current_user.id, data=request)
    
    # 2. Recalculate vector synchronously for this MVP (runs extremely fast)
    await MLRecommendationEngine.build_and_save_vector(db, user_id=current_user.id)
    
    return {"status": "success", "message": "Interaction logged and interest profiles updated."}


@router.get("/recommend/news", response_model=List[Dict[str, Any]])
async def get_recommended_news(
    limit: int = Query(10, ge=1, le=30),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    mongo_db = Depends(get_mongodb)
):
    """Retrieve news feed sorted by cosine similarity to the user's behavior preference vector."""
    service = MLPersonalizationService(db, mongo_db)
    return await service.recommend_news(user_id=current_user.id, limit=limit)


@router.get("/recommend/assets", response_model=List[AssetResponse])
async def get_recommended_assets(
    limit: int = Query(5, ge=1, le=10),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Retrieve recommended asset highlights matching user profile affinity."""
    service = MLPersonalizationService(db)
    assets = await service.recommend_assets(user_id=current_user.id, limit=limit)
    
    # Format database models to schema
    formatted = []
    for a in assets:
        formatted.append({
            "id": a.id,
            "symbol": a.symbol,
            "name": a.name,
            "asset_type": a.asset_type,
            "description": a.description,
            "logo_url": a.logo_url,
            "is_active": a.is_active
        })
    return formatted
