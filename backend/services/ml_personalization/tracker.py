"""Event tracking for compiling user behavior insights."""
import logging
from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession

from shared.models import UserBehaviorEvent
from services.ml_personalization.schemas import BehaviorEventCreate

logger = logging.getLogger(__name__)


async def track_event(db: AsyncSession, user_id: int, data: BehaviorEventCreate) -> UserBehaviorEvent:
    """Save a user interaction event to the database for ML scoring."""
    event = UserBehaviorEvent(
        user_id=user_id,
        event_type=data.event_type,
        target_type=data.target_type,
        target_id=data.target_id,
        event_metadata=data.metadata or {},
        created_at=datetime.utcnow()
    )
    db.add(event)
    await db.flush()
    logger.info(f"Tracked ML event for user {user_id}: {data.event_type} on {data.target_type}:{data.target_id}")
    return event
