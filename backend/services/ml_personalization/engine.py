"""ML calculations for user preferences vectors and content recommendations."""
import math
import logging
from datetime import datetime
from typing import Dict, List, Any, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import and_

from shared.models import UserPreferenceVector, UserBehaviorEvent, Asset

logger = logging.getLogger(__name__)


def cosine_similarity(vec1: Dict[str, float], vec2: Dict[str, float]) -> float:
    """Calculate the cosine similarity between two feature vectors."""
    # Find union of keys
    keys = set(vec1.keys()).union(set(vec2.keys()))
    
    dot_product = 0.0
    norm1 = 0.0
    norm2 = 0.0
    
    for k in keys:
        val1 = vec1.get(k, 0.0)
        val2 = vec2.get(k, 0.0)
        dot_product += val1 * val2
        norm1 += val1 ** 2
        norm2 += val2 ** 2
        
    if norm1 == 0.0 or norm2 == 0.0:
        return 0.0
        
    return dot_product / (math.sqrt(norm1) * math.sqrt(norm2))


class MLRecommendationEngine:
    """Engine responsible for building preference profiles and ranking items."""

    @staticmethod
    async def build_and_save_vector(db: AsyncSession, user_id: int) -> UserPreferenceVector:
        """Analyze user behavior events to compile and save preference vectors in the DB."""
        # 1. Fetch user behaviors
        stmt = select(UserBehaviorEvent).where(UserBehaviorEvent.user_id == user_id)
        result = await db.execute(stmt)
        events = result.scalars().all()

        # Default features
        vector = {"forex": 0.33, "stocks": 0.33, "crypto": 0.33}
        risk_pref = 0.5
        experience = "intermediate"

        if events:
            # Let's count views per asset category
            # To know the asset category, we query assets that match target_id (symbol)
            forex_hits = 0
            stocks_hits = 0
            crypto_hits = 0
            
            # Simple heuristic mapping for demo
            for ev in events:
                if ev.target_type == "asset":
                    sym = ev.target_id.upper()
                    # Query asset category from DB (mock mapping in case DB query is slow)
                    if any(c in sym for c in ["USD", "EUR", "GBP", "JPY", "CHF"]):
                        forex_hits += 1
                    elif any(c in sym for c in ["BTC", "ETH", "SOL", "USDT", "ADA", "DOGE"]):
                        crypto_hits += 1
                    else:
                        stocks_hits += 1
                elif ev.target_type == "news":
                    # news events
                    cat = ev.event_metadata.get("category", "")
                    if cat == "forex":
                        forex_hits += 1
                    elif cat == "crypto":
                        crypto_hits += 1
                    elif cat == "stocks":
                        stocks_hits += 1

            total_hits = forex_hits + stocks_hits + crypto_hits
            if total_hits > 0:
                vector["forex"] = round(forex_hits / total_hits, 3)
                vector["stocks"] = round(stocks_hits / total_hits, 3)
                vector["crypto"] = round(crypto_hits / total_hits, 3)

            # Heuristics for Experience Level: based on total interactions
            if len(events) > 50:
                experience = "advanced"
            elif len(events) > 150:
                experience = "expert"
            else:
                experience = "beginner"

            # Heuristics for Risk Preference: crypto affinity increases risk tolerance
            crypto_ratio = vector.get("crypto", 0.33)
            risk_pref = min(1.0, max(0.0, 0.2 + (crypto_ratio * 0.8)))

        # 2. Check if vector exists
        find_query = select(UserPreferenceVector).where(UserPreferenceVector.user_id == user_id)
        find_res = await db.execute(find_query)
        pref_vec = find_res.scalar_one_or_none()

        now = datetime.utcnow()
        if pref_vec:
            pref_vec.vector = vector
            pref_vec.risk_preference = risk_pref
            pref_vec.experience_level = experience
            pref_vec.updated_at = now
        else:
            pref_vec = UserPreferenceVector(
                user_id=user_id,
                vector=vector,
                risk_preference=risk_pref,
                experience_level=experience,
                updated_at=now
            )
            db.add(pref_vec)

        await db.flush()
        return pref_vec

    @staticmethod
    def rank_items(user_vector: Dict[str, float], items: List[Dict[str, Any]], item_vector_func) -> List[Dict[str, Any]]:
        """Sort items in descending order of similarity with the user vector."""
        scored_items = []
        for item in items:
            item_vector = item_vector_func(item)
            similarity = cosine_similarity(user_vector, item_vector)
            
            # Keep original item properties and insert a score
            scored_item = item.copy()
            scored_item["relevance_score"] = round(similarity, 4)
            scored_items.append(scored_item)

        # Sort by relevance score descending
        scored_items.sort(key=lambda x: x["relevance_score"], reverse=True)
        return scored_items
