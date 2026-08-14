"""Notification delivery channels (InApp WebSocket, Email, Web Push)."""
import logging
from abc import ABC, abstractmethod
from typing import Dict, Any

from shared.websocket_manager import manager

logger = logging.getLogger(__name__)


class NotificationChannel(ABC):
    """Abstract base class for notification delivery channels."""

    @abstractmethod
    async def send(self, user_id: int, title: str, message: str, data: Dict[str, Any] = None) -> bool:
        """Deliver the notification to the target user."""
        pass


class InAppChannel(NotificationChannel):
    """Deliver real-time notifications via active WebSocket connections."""

    async def send(self, user_id: Any, title: str, message: str, data: Dict[str, Any] = None) -> bool:
        try:
            from datetime import datetime
            data_dict = data or {}
            payload = {
                "type": "notification",
                "notification": {
                    "id": str(data_dict.get("id", "")),
                    "user_id": str(user_id),
                    "type": str(data_dict.get("type", "system")),
                    "title": title,
                    "message": message,
                    "data": data_dict,
                    "is_read": False,
                    "created_at": datetime.utcnow().isoformat()
                }
            }
            channel_name = f"user_notifications_{user_id}"
            await manager.broadcast(channel_name, payload)
            logger.info(f"InApp notification broadcasted to channel {channel_name}: {title}")
            return True
        except Exception as e:
            logger.error(f"Failed to send InApp notification: {e}")
            return False


class EmailChannel(NotificationChannel):
    """Mock channel for SMTP email notifications."""

    async def send(self, user_id: int, title: str, message: str, data: Dict[str, Any] = None) -> bool:
        logger.info(f"[EMAIL MOCK] Sending email to user {user_id}. Title: '{title}'")
        # In production, this would use a mailer client (e.g. SMTP or SendGrid/Mailgun)
        return True


class PushChannel(NotificationChannel):
    """Mock channel for browser Web Push notifications."""

    async def send(self, user_id: int, title: str, message: str, data: Dict[str, Any] = None) -> bool:
        logger.info(f"[PUSH MOCK] Dispatching web push notification to user {user_id}. Title: '{title}'")
        # In production, this would use pywebpush and VAPID key configurations
        return True
