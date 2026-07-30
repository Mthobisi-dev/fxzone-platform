"""FastAPI router for the FxZone AI Assistant."""
from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Any as AnyType, Optional

from shared.database import get_db, get_mongodb, get_redis
from shared.security import get_current_user, get_current_user_optional
from shared.models import User
from services.ai_assistant.service import AIAssistantService
from services.ai_assistant.schemas import (
    AIChatRequest,
    AIChatResponse,
    AIAnalysisRequest,
    AIAnalysisResponse,
    AISentimentResponse,
    AIInsightsResponse
)

router = APIRouter(prefix="/api/ai", tags=["AI Assistant"])


@router.post("/chat", response_model=AIChatResponse)
async def chat_message(
    request: AIChatRequest,
    current_user: Optional[dict] = Depends(get_current_user_optional),
    db: AsyncSession = Depends(get_db),
    mongo_db = Depends(get_mongodb),
    redis = Depends(get_redis)
):
    """Send a chat message to the AI assistant (standard non-streaming response).
    Authentication is optional — guest users can also chat with the AI."""
    service = AIAssistantService(db, mongo_db, redis)
    try:
        user_id = current_user.id if current_user else None
        result = await service.chat(
            user_id=user_id,
            message=request.message,
            conversation_id=request.conversation_id
        )
        return result
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"AI chat error: {str(e)}"
        )


@router.post("/chat/stream")
async def chat_message_stream(
    request: AIChatRequest,
    current_user: Optional[dict] = Depends(get_current_user_optional),
    db: AsyncSession = Depends(get_db),
    mongo_db = Depends(get_mongodb),
    redis = Depends(get_redis)
):
    """Stream chat responses chunk by chunk using EventSource/SSE format.
    Authentication is optional — guest users can also chat with the AI."""
    service = AIAssistantService(db, mongo_db, redis)
    user_id = current_user.id if current_user else None
    
    async def event_generator():
        try:
            async for chunk in service.chat_stream(
                user_id=user_id,
                message=request.message,
                conversation_id=request.conversation_id
            ):
                yield f"data: {chunk}\n\n"
        except Exception as e:
            yield f"data: [ERROR] {str(e)}\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")


@router.post("/analyze/{symbol}", response_model=AIAnalysisResponse)
async def analyze_asset(
    symbol: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    mongo_db = Depends(get_mongodb),
    redis = Depends(get_redis)
):
    """Trigger a deep fundamental, technical, and sentiment analysis for an asset."""
    service = AIAssistantService(db, mongo_db, redis)
    try:
        response = await service.analyze_asset(user_id=current_user.id, symbol=symbol.upper())
        return response
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"AI asset analysis error: {str(e)}"
        )


@router.get("/sentiment/{symbol}", response_model=AISentimentResponse)
async def get_asset_sentiment(
    symbol: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    mongo_db = Depends(get_mongodb),
    redis = Depends(get_redis)
):
    """Retrieve instant market sentiment score and reasoning for a ticker symbol."""
    service = AIAssistantService(db, mongo_db, redis)
    try:
        response = await service.get_sentiment(symbol=symbol.upper())
        return response
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"AI sentiment lookup error: {str(e)}"
        )


@router.get("/insights", response_model=AIInsightsResponse)
async def get_watchlist_insights(
    current_user: Optional[dict] = Depends(get_current_user_optional),
    db: AsyncSession = Depends(get_db),
    mongo_db = Depends(get_mongodb),
    redis = Depends(get_redis)
):
    """Retrieve brief sentiment insights for the user's watchlist assets."""
    service = AIAssistantService(db, mongo_db, redis)
    try:
        user_id = current_user.id if current_user else None
        response = await service.get_insights(user_id=user_id)
        return response
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"AI insights error: {str(e)}"
        )
