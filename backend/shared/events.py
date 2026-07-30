"""FxZone Redis Streams event bus for microservice communication."""
import json
import logging
from typing import AsyncGenerator, Dict, Any, Optional
from shared.database import get_redis

logger = logging.getLogger(__name__)

# Event stream names
STREAM_MARKET_DATA = "stream:market_data"
STREAM_NEWS = "stream:news"
STREAM_SOCIAL = "stream:social"
STREAM_NOTIFICATIONS = "stream:notifications"
STREAM_SESSIONS = "stream:sessions"


async def publish_event(stream: str, event_type: str, data: Dict[str, Any]) -> Optional[str]:
    """Publish an event to a Redis Stream."""
    redis = get_redis()
    if not redis:
        logger.warning(f"Redis not available, skipping event: {event_type}")
        return None

    try:
        event = {
            "event_type": event_type,
            "data": json.dumps(data),
        }
        message_id = await redis.xadd(stream, event, maxlen=10000)
        logger.debug(f"Published event: stream={stream}, type={event_type}, id={message_id}")
        return message_id
    except Exception as e:
        logger.error(f"Failed to publish event: {e}")
        return None


async def subscribe_events(
    stream: str,
    group: str,
    consumer: str,
    count: int = 10,
    block: int = 5000,
) -> AsyncGenerator[Dict[str, Any], None]:
    """Subscribe to events from a Redis Stream using consumer groups."""
    redis = get_redis()
    if not redis:
        return

    # Create consumer group if not exists
    try:
        await redis.xgroup_create(stream, group, id="0", mkstream=True)
    except Exception:
        pass  # Group already exists

    while True:
        try:
            messages = await redis.xreadgroup(
                group, consumer, {stream: ">"}, count=count, block=block
            )
            if not messages:
                continue

            for stream_name, entries in messages:
                for message_id, fields in entries:
                    try:
                        event = {
                            "id": message_id,
                            "event_type": fields.get("event_type", "unknown"),
                            "data": json.loads(fields.get("data", "{}")),
                        }
                        yield event
                        await redis.xack(stream, group, message_id)
                    except json.JSONDecodeError:
                        logger.error(f"Invalid JSON in event: {message_id}")
                        await redis.xack(stream, group, message_id)
        except Exception as e:
            logger.error(f"Error consuming events: {e}")
            break
