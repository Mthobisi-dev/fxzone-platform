"""Business logic orchestrating FxZone ML personalization recommendations."""
import logging
from typing import List, Dict, Any, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from shared.models import UserPreferenceVector, Asset
from services.ml_personalization.engine import MLRecommendationEngine

logger = logging.getLogger(__name__)


class MLPersonalizationService:
    """Service handling compilation of user preference profiles and generating recommendations."""

    def __init__(self, db: AsyncSession, mongo_db = None):
        self.db = db
        self.mongo_db = mongo_db

    async def get_user_vector(self, user_id: int) -> UserPreferenceVector:
        """Fetch the user's preference vector. Compiles a fresh one if missing."""
        query = select(UserPreferenceVector).where(UserPreferenceVector.user_id == user_id)
        res = await self.db.execute(query)
        pref_vec = res.scalar_one_or_none()

        if not pref_vec:
            # Generate a new vector based on existing history (or defaults if no history)
            pref_vec = await MLRecommendationEngine.build_and_save_vector(self.db, user_id)

        return pref_vec

    async def recommend_news(self, user_id: int, limit: int = 10) -> List[Dict[str, Any]]:
        """Fetch latest news from MongoDB and sort based on user preferences."""
        if self.mongo_db is None:
            logger.warning("MongoDB not connected. Recommended news is empty.")
            return []

        # 1. Fetch user vector
        pref_record = await self.get_user_vector(user_id)
        user_vector = pref_record.vector

        # 2. Fetch raw articles from MongoDB
        collection = self.mongo_db.news_articles
        cursor = collection.find({}, {"_id": 0}).sort("published_at", -1).limit(50)
        articles = await cursor.to_list(length=50)

        # 3. Helper to define article vectors based on categories
        def get_article_vector(article: Dict[str, Any]) -> Dict[str, float]:
            cat = article.get("category", "").lower()
            if cat == "forex":
                return {"forex": 1.0, "stocks": 0.0, "crypto": 0.0}
            elif cat == "stocks":
                return {"forex": 0.0, "stocks": 1.0, "crypto": 0.0}
            elif cat == "crypto":
                return {"forex": 0.0, "stocks": 0.0, "crypto": 1.0}
            return {"forex": 0.33, "stocks": 0.33, "crypto": 0.33}

        # 4. Rank using engine
        ranked = MLRecommendationEngine.rank_items(user_vector, articles, get_article_vector)
        return ranked[:limit]

    async def recommend_assets(self, user_id: int, limit: int = 5) -> List[Asset]:
        """Recommend trading assets the user is likely interested in based on similarity."""
        # 1. Fetch user vector
        pref_record = await self.get_user_vector(user_id)
        user_vector = pref_record.vector

        # 2. Fetch all tradeable assets
        query = select(Asset).where(Asset.is_active == True)
        res = await self.db.execute(query)
        assets = list(res.scalars().all())

        # 3. Convert assets to dictionaries for ranking
        asset_dicts = []
        for a in assets:
            asset_dicts.append({
                "model_object": a,
                "asset_type": a.asset_type.lower()
            })

        # Helper to define asset vector
        def get_asset_vector(item: Dict[str, Any]) -> Dict[str, float]:
            atype = item["asset_type"]
            if atype == "forex":
                return {"forex": 1.0, "stocks": 0.0, "crypto": 0.0}
            elif atype == "stock":
                return {"forex": 0.0, "stocks": 1.0, "crypto": 0.0}
            elif atype == "crypto":
                return {"forex": 0.0, "stocks": 0.0, "crypto": 1.0}
            return {"forex": 0.33, "stocks": 0.33, "crypto": 0.33}

        # 4. Rank
        ranked_dicts = MLRecommendationEngine.rank_items(user_vector, asset_dicts, get_asset_vector)
        
        # 5. Extract original ORM objects
        recommended_assets = [item["model_object"] for item in ranked_dicts[:limit]]
        return recommended_assets
