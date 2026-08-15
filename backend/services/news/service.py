"""Business logic for the news intelligence service."""
import logging
from typing import List, Dict, Any, Optional
from datetime import datetime

logger = logging.getLogger(__name__)


class NewsService:
    """Service to handle fetching, searching, and ranking financial news."""

    def __init__(self, mongo_db):
        self.mongo_db = mongo_db

    async def get_news_feed(
        self, 
        category: Optional[str] = None, 
        limit: int = 15, 
        offset: int = 0
    ) -> List[Dict[str, Any]]:
        """Retrieve news articles from MongoDB, filtered by category and sorted by published date."""
        if self.mongo_db is None:
            logger.warning("MongoDB not connected. Returning empty news feed.")
            return []

        query = {}
        if category and category.lower() != "all":
            query["category"] = category.lower()

        try:
            collection = self.mongo_db.news_articles
            cursor = (
                collection.find(query, {"_id": 0})
                .sort("published_at", -1)
                .skip(offset)
                .limit(limit)
            )
            articles = await cursor.to_list(length=limit)
            return articles
        except Exception as e:
            logger.error(f"Error fetching news feed: {e}")
            return []

    async def get_breaking_news(self, limit: int = 5) -> List[Dict[str, Any]]:
        """Retrieve breaking or high-impact news articles."""
        if self.mongo_db is None:
            return []

        # Find articles with [BREAKING] in title or high absolute sentiment score (> 0.6)
        query = {
            "$or": [
                {"title": {"$regex": "\\[BREAKING\\]", "$options": "i"}},
                {"sentiment_score": {"$gte": 0.6}},
                {"sentiment_score": {"$lte": -0.6}}
            ]
        }

        try:
            collection = self.mongo_db.news_articles
            cursor = (
                collection.find(query, {"_id": 0})
                .sort("published_at", -1)
                .limit(limit)
            )
            return await cursor.to_list(length=limit)
        except Exception as e:
            logger.error(f"Error fetching breaking news: {e}")
            return []

    async def get_asset_news(self, symbol: str, limit: int = 10) -> List[Dict[str, Any]]:
        """Fetch news articles relevant to a specific asset symbol."""
        if self.mongo_db is None:
            return []

        query = {"asset_tags": symbol.upper()}

        try:
            collection = self.mongo_db.news_articles
            cursor = (
                collection.find(query, {"_id": 0})
                .sort("published_at", -1)
                .limit(limit)
            )
            return await cursor.to_list(length=limit)
        except Exception as e:
            logger.error(f"Error fetching news for asset {symbol}: {e}")
            return []

    async def search_news(self, search_query: str, limit: int = 10) -> List[Dict[str, Any]]:
        """Search news articles using sanitized regex matching on title, content, or tags."""
        if self.mongo_db is None or not search_query or not search_query.strip():
            return []

        import re
        safe_query = re.escape(search_query.strip())

        query = {
            "$or": [
                {"title": {"$regex": safe_query, "$options": "i"}},
                {"content": {"$regex": safe_query, "$options": "i"}},
                {"asset_tags": {"$regex": safe_query, "$options": "i"}}
            ]
        }

        try:
            collection = self.mongo_db.news_articles
            cursor = (
                collection.find(query, {"_id": 0})
                .sort("published_at", -1)
                .limit(limit)
            )
            return await cursor.to_list(length=limit)
        except Exception as e:
            logger.error(f"Error searching news for query '{search_query}': {e}")
            return []
