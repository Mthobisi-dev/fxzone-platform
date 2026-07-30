"""Business logic for the AI Trading Assistant service."""
import asyncio
import json
import logging
import uuid
from datetime import datetime
from typing import List, Dict, Any, Optional, AsyncGenerator
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Any as AnyType

from services.ai_assistant.llm_client import get_llm_client
from services.ai_assistant.prompts import (
    SYSTEM_PROMPT,
    ANALYSIS_TEMPLATE,
    SENTIMENT_TEMPLATE,
    RISK_DISCLAIMER
)
from services.ai_assistant.context import (
    build_user_context,
    build_market_context,
    build_news_context,
    format_prompt_context
)
from services.ai_assistant.schemas import (
    AIAnalysisResponse,
    AISentimentResponse,
    AIInsightItem,
    AIInsightsResponse
)
from shared.models import Asset

logger = logging.getLogger(__name__)


class AIAssistantService:
    """Service handling trading intelligence, LLM routing, and chat memory."""

    def __init__(self, db: AsyncSession, mongo_db, redis):
        self.db = db
        self.mongo_db = mongo_db
        self.redis = redis
        self.llm = get_llm_client()

    async def chat(
        self, 
        user_id: Optional[int] = None, 
        message: str = "", 
        conversation_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """Send a message to the AI chatbot, leveraging conversation history in MongoDB."""
        if not conversation_id:
            conversation_id = uuid.uuid4().hex

        # 1. Fetch conversation history from MongoDB (skip if guest/no MongoDB)
        history = []
        if user_id is not None and self.mongo_db is not None:
            try:
                conv = await self.mongo_db.ai_conversations.find_one(
                    {"conversation_id": conversation_id, "user_id": str(user_id)}
                )
                if conv:
                    history = conv.get("messages", [])[-10:]  # Limit to last 10 messages
            except Exception as e:
                logger.warning(f"MongoDB history lookup failed: {e}")

        # 2. Fetch user context to customize the model's understanding
        if user_id is not None:
            user_ctx = await build_user_context(self.db, user_id)
        else:
            user_ctx = {
                "experience_level": "Intermediate",
                "risk_preference": 0.5,
                "watchlist_symbols": ["BTCUSD", "EURUSD", "AAPL"]
            }
        
        # 3. Assemble prompt with history
        history_str = ""
        for msg in history:
            role = "User" if msg["role"] == "user" else "Assistant"
            history_str += f"{role}: {msg['content']}\n"
            
        full_prompt = (
            f"User Profile Info:\n"
            f"- Experience Level: {user_ctx['experience_level']}\n"
            f"- Watchlist Assets: {', '.join(user_ctx['watchlist_symbols'])}\n\n"
            f"Conversation History:\n{history_str}\n"
            f"User: {message}\n"
            f"Assistant:"
        )

        # 4. Generate response from LLM
        ai_response = await self.llm.generate(full_prompt, system_prompt=SYSTEM_PROMPT)

        # 5. Append risk disclaimer if it is not present
        if "disclaimer" not in ai_response.lower():
            ai_response += f"\n\n---\n*{RISK_DISCLAIMER}*"

        # 6. Save back to MongoDB (skip for guests or if no MongoDB)
        if user_id is not None and self.mongo_db is not None:
            new_messages = history + [
                {"role": "user", "content": message, "timestamp": datetime.utcnow().isoformat()},
                {"role": "assistant", "content": ai_response, "timestamp": datetime.utcnow().isoformat()}
            ]
            try:
                await self.mongo_db.ai_conversations.update_one(
                    {"conversation_id": conversation_id, "user_id": str(user_id)},
                    {
                        "$set": {
                            "messages": new_messages,
                            "updated_at": datetime.utcnow().isoformat()
                        }
                    },
                    upsert=True
                )
            except Exception as e:
                logger.warning(f"MongoDB conversation save failed: {e}")

        return {
            "message": ai_response,
            "conversation_id": conversation_id,
            "risk_disclaimer": RISK_DISCLAIMER
        }

    async def chat_stream(
        self, 
        user_id: Optional[int] = None, 
        message: str = "", 
        conversation_id: Optional[str] = None
    ) -> AsyncGenerator[str, None]:
        """Stream chat responses chunk by chunk."""
        if not conversation_id:
            conversation_id = uuid.uuid4().hex

        history = []
        if user_id is not None and self.mongo_db is not None:
            try:
                conv = await self.mongo_db.ai_conversations.find_one(
                    {"conversation_id": conversation_id, "user_id": str(user_id)}
                )
                if conv:
                    history = conv.get("messages", [])[-10:]
            except Exception as e:
                logger.warning(f"MongoDB stream history lookup failed: {e}")

        if user_id is not None:
            user_ctx = await build_user_context(self.db, user_id)
        else:
            user_ctx = {
                "experience_level": "Intermediate",
                "risk_preference": 0.5,
                "watchlist_symbols": ["BTCUSD", "EURUSD", "AAPL"]
            }
        
        history_str = ""
        for msg in history:
            role = "User" if msg["role"] == "user" else "Assistant"
            history_str += f"{role}: {msg['content']}\n"
            
        full_prompt = (
            f"User Profile Info:\n"
            f"- Experience: {user_ctx['experience_level']}\n"
            f"History:\n{history_str}\n"
            f"User: {message}\n"
            f"Assistant:"
        )

        full_reply = ""
        async for chunk in self.llm.stream(full_prompt, system_prompt=SYSTEM_PROMPT):
            full_reply += chunk
            yield chunk

        # Append disclaimer
        disclaimer_suffix = f"\n\n---\n*{RISK_DISCLAIMER}*"
        yield disclaimer_suffix
        full_reply += disclaimer_suffix

        # Save to MongoDB at the end (skip for guests)
        if user_id is not None and self.mongo_db is not None:
            new_messages = history + [
                {"role": "user", "content": message, "timestamp": datetime.utcnow().isoformat()},
                {"role": "assistant", "content": full_reply, "timestamp": datetime.utcnow().isoformat()}
            ]
            try:
                await self.mongo_db.ai_conversations.update_one(
                    {"conversation_id": conversation_id, "user_id": str(user_id)},
                    {
                        "$set": {
                            "messages": new_messages,
                            "updated_at": datetime.utcnow().isoformat()
                        }
                    },
                    upsert=True
                )
            except Exception as e:
                logger.warning(f"MongoDB stream save failed: {e}")

    async def analyze_asset(self, user_id: int, symbol: str) -> AIAnalysisResponse:
        """Perform a deep analysis of an asset combining technical, fundamental, and sentiment context."""
        user_ctx = await build_user_context(self.db, user_id)
        market_ctx = await build_market_context(self.db, symbol)
        
        # Pull live price from Redis if present
        if self.redis:
            try:
                cached_price = await self.redis.get(f"price:{symbol}")
                if cached_price:
                    price_data = json.loads(cached_price)
                    market_ctx["price"] = f"${price_data.get('price', 0.0):,.4f}"
                    market_ctx["change_24h"] = f"{price_data.get('change_24h', 0.0):+.2f}"
            except Exception as e:
                logger.error(f"Failed to fetch price from Redis for {symbol}: {e}")

        # Fetch recent news context
        news_str = await build_news_context(self.mongo_db, symbol, limit=3)

        prompt = ANALYSIS_TEMPLATE.format(
            symbol=symbol,
            name=market_ctx["name"],
            price=market_ctx["price"],
            change_24h=market_ctx["change_24h"],
            asset_type=market_ctx["asset_type"],
            technical_summary=market_ctx["technical_summary"],
            news_context=news_str,
            experience_level=user_ctx["experience_level"],
            risk_preference=user_ctx["risk_preference"]
        )

        analysis_text = await self.llm.generate(prompt, system_prompt=SYSTEM_PROMPT)
        
        # Deduce sentiment label from text
        sentiment = "Neutral"
        analysis_lower = analysis_text.lower()
        if "sentiment: bullish" in analysis_lower or "**bullish**" in analysis_lower:
            sentiment = "Bullish"
        elif "sentiment: bearish" in analysis_lower or "**bearish**" in analysis_lower:
            sentiment = "Bearish"

        # Cache snapshot in MongoDB
        insight_snapshot = {
            "symbol": symbol,
            "name": market_ctx["name"],
            "sentiment": sentiment,
            "confidence": 0.80,
            "analysis": analysis_text,
            "user_id": str(user_id),
            "created_at": datetime.utcnow().isoformat()
        }
        if self.mongo_db is not None:
            await self.mongo_db.ai_insights.insert_one(insight_snapshot)

        return AIAnalysisResponse(
            symbol=symbol,
            name=market_ctx["name"],
            sentiment=sentiment,
            confidence=0.80,
            analysis=analysis_text,
            risk_disclaimer=RISK_DISCLAIMER
        )

    async def get_sentiment(
        self,
        symbol: str,
        name: Optional[str] = None,
        asset_type: Optional[str] = None
    ) -> AISentimentResponse:
        """Fetch quick sentiment analytics and brief reasoning for an asset."""
        # 0. Check Redis cache first — avoid hitting the LLM if we have a recent result
        if self.redis:
            try:
                cached = await self.redis.get(f"sentiment:{symbol}")
                if cached:
                    data = json.loads(cached)
                    logger.info(f"Cache HIT for sentiment:{symbol}")
                    return AISentimentResponse(
                        symbol=symbol,
                        sentiment=data.get("sentiment", "Neutral"),
                        confidence=data.get("confidence", 0.50),
                        reasoning=data.get("reasoning", "Cached sentiment."),
                    )
            except Exception as e:
                logger.warning(f"Redis sentiment cache read failed for {symbol}: {e}")

        # 1. Build market context — skip DB if caller already provided name/type
        if name is not None and asset_type is not None:
            market_ctx = {
                "symbol": symbol,
                "name": name,
                "price": "N/A",
                "change_24h": "0.0",
                "asset_type": asset_type,
                "technical_summary": (
                    "Consolidating above the 50-day moving average. "
                    "RSI is neutral (54). Volume is in line with 10-day average."
                ),
            }
        else:
            market_ctx = await build_market_context(self.db, symbol)

        # 2. Enrich with live price from Redis
        if self.redis:
            try:
                cached_price = await self.redis.get(f"price:{symbol}")
                if cached_price:
                    price_data = json.loads(cached_price)
                    market_ctx["price"] = f"${price_data.get('price', 0.0):,.4f}"
                    market_ctx["change_24h"] = f"{price_data.get('change_24h', 0.0):+.2f}"
            except Exception as e:
                logger.error(f"Failed to fetch price from Redis: {e}")

        # 3. Fetch news sentiment from MongoDB
        news_sentiment = "Neutral"
        if self.mongo_db is not None:
            pipeline = [
                {"$match": {"asset_tags": symbol}},
                {"$group": {"_id": None, "avg_sentiment": {"$avg": "$sentiment_score"}}}
            ]
            cursor = self.mongo_db.news_articles.aggregate(pipeline)
            res = await cursor.to_list(length=1)
            if res and res[0]["avg_sentiment"]:
                avg = res[0]["avg_sentiment"]
                news_sentiment = "Bullish" if avg > 0.15 else "Bearish" if avg < -0.15 else "Neutral"

        # 4. Call the LLM
        prompt = SENTIMENT_TEMPLATE.format(
            symbol=symbol,
            name=market_ctx["name"],
            price=market_ctx["price"],
            change_24h=market_ctx["change_24h"],
            news_sentiment_summary=f"The average sentiment scoring of recent news is {news_sentiment}."
        )

        resp_text = await self.llm.generate(prompt, system_prompt="You are a JSON generator. Respond ONLY with valid JSON. Do not include markdown wraps.")

        try:
            clean_text = resp_text.strip()
            if clean_text.startswith("```json"):
                clean_text = clean_text[7:]
            if clean_text.endswith("```"):
                clean_text = clean_text[:-3]
            clean_text = clean_text.strip()

            data = json.loads(clean_text)
            result = AISentimentResponse(
                symbol=symbol,
                sentiment=data.get("sentiment", "Neutral"),
                confidence=data.get("confidence", 0.70),
                reasoning=data.get("reasoning", "Consensus points to range-bound stability.")
            )
        except Exception as e:
            logger.error(f"Failed to parse sentiment LLM response for {symbol}: {e}. Raw: {resp_text}")
            result = AISentimentResponse(
                symbol=symbol,
                sentiment="Neutral",
                confidence=0.50,
                reasoning="Could not parse sentiment payload. The asset remains within key horizontal support margins."
            )

        # 5. Cache result in Redis for 5 minutes (300 seconds)
        if self.redis:
            try:
                await self.redis.set(
                    f"sentiment:{symbol}",
                    json.dumps({
                        "sentiment": result.sentiment,
                        "confidence": result.confidence,
                        "reasoning": result.reasoning,
                    }),
                    ex=300,
                )
                logger.info(f"Cached sentiment:{symbol} for 300s")
            except Exception as e:
                logger.warning(f"Redis sentiment cache write failed for {symbol}: {e}")

        return result

    async def get_insights(self, user_id: Optional[Any] = None) -> AIInsightsResponse:
        """Generate high-level sentiment summaries for all assets on the user's watchlist."""
        if user_id is not None:
            user_ctx = await build_user_context(self.db, user_id)
            symbols = user_ctx.get("watchlist_symbols", [])
        else:
            symbols = ["BTCUSD", "EURUSD", "AAPL"]

        # Default fallback symbols if user watchlist is empty
        if not symbols:
            symbols = ["BTCUSD", "EURUSD", "AAPL"]

        # Batch-load all Asset records in a single DB query
        asset_map: Dict[str, Any] = {}
        try:
            query = select(Asset).where(Asset.symbol.in_(symbols))
            res = await self.db.execute(query)
            for asset in res.scalars().all():
                asset_map[asset.symbol] = asset
        except Exception as e:
            logger.error(f"Failed to batch-load assets for insights: {e}")

        async def _fetch_insight(symbol: str) -> AIInsightItem:
            asset = asset_map.get(symbol)
            asset_name = asset.name if asset else symbol
            asset_type = asset.asset_type if asset else "Crypto"

            sentiment_data = await self.get_sentiment(
                symbol, name=asset_name, asset_type=asset_type
            )

            return AIInsightItem(
                symbol=symbol,
                name=asset_name,
                sentiment=sentiment_data.sentiment,
                confidence=sentiment_data.confidence,
                summary=sentiment_data.reasoning,
                timestamp=datetime.utcnow(),
            )

        # Run all sentiment lookups concurrently
        insights = list(await asyncio.gather(*[_fetch_insight(s) for s in symbols]))

        return AIInsightsResponse(insights=insights)
