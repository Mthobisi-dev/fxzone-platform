"""News + AI endpoints."""
from __future__ import annotations

from fastapi import APIRouter, Depends, Query, Request

from ..db import Database
from ..deps import get_db
from ..errors import BadRequest
from ..ratelimit import rate_limit
from ..schemas import AiChatBody
from ..security import CurrentUser, require_user
from ..services.news import news_to_api

news_router = APIRouter(prefix="/api/news", tags=["news"])
ai_router = APIRouter(prefix="/api/ai", tags=["ai"])


@news_router.get("/feed", dependencies=[Depends(rate_limit("news_read", 120))])
async def news_feed(limit: int = Query(20, ge=1, le=100), offset: int = Query(0, ge=0, le=1000),
                    category: str | None = Query(None, max_length=20), symbol: str | None = Query(None, max_length=20),
                    db: Database = Depends(get_db)):
    """Real headlines from the ingested feeds; an empty list (not placeholder stories) when nothing has been ingested."""
    rows = await db.fetch(
        """SELECT id, title, summary, url, source, published_at, sentiment, sentiment_score, symbols, category, image_url
           FROM news_articles WHERE ($1::text IS NULL OR category = $1) AND ($2::text IS NULL OR $2 = ANY(symbols))
           ORDER BY published_at DESC LIMIT $3 OFFSET $4""",
        category, symbol.upper() if symbol else None, limit, offset)
    return [news_to_api(r) for r in rows]


@ai_router.get("/insights", dependencies=[Depends(rate_limit("ai_insights", 60))])
async def insights(request: Request):
    return {"insights": await request.app.state.ai.insights()}


@ai_router.get("/sentiment/{symbol}", dependencies=[Depends(rate_limit("ai_sentiment", 30))])
async def sentiment(symbol: str, request: Request, _: CurrentUser = Depends(require_user)):
    return await request.app.state.ai.analyze(symbol)


@ai_router.post("/chat", dependencies=[Depends(rate_limit("ai_chat", 12))])
async def chat(body: AiChatBody, request: Request, user: CurrentUser = Depends(require_user)):
    if not body.text:
        raise BadRequest("message is required")
    return await request.app.state.ai.chat(user.sid, body.text, body.conversation_id)
