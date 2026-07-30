"""Business logic for the FxZone Notifications service."""
import logging
from datetime import datetime
from typing import List, Dict, Any, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import and_, update

from shared.models import Notification, NotificationPreference
from services.notifications.channels import InAppChannel, EmailChannel, PushChannel

logger = logging.getLogger(__name__)

# Channel map
CHANNELS = {
    "in_app": InAppChannel(),
    "email": EmailChannel(),
    "push": PushChannel()
}


class NotificationService:
    """Service to handle notification logging, updates, and channel routing."""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def create_notification(
        self, 
        user_id: int, 
        notification_type: str, 
        title: str, 
        message: str, 
        data: Optional[Dict[str, Any]] = None
    ) -> Notification:
        """Create a notification in the database and dispatch it over active channels."""
        now = datetime.utcnow()
        
        # 1. Fetch user's notification preferences
        pref_query = select(NotificationPreference).where(
            and_(
                NotificationPreference.user_id == user_id,
                NotificationPreference.type == notification_type
            )
        )
        res = await self.db.execute(pref_query)
        pref = res.scalar_one_or_none()

        # Defaults if no preference is configured
        in_app_enabled = pref.in_app_enabled if pref else True
        email_enabled = pref.email_enabled if pref else False
        push_enabled = pref.push_enabled if pref else False

        # 2. Insert notification record
        notification = Notification(
            user_id=user_id,
            type=notification_type,
            title=title,
            message=message,
            data=data or {},
            is_read=False,
            created_at=now
        )
        self.db.add(notification)
        await self.db.flush()

        # 3. Dispatch through active channels
        if in_app_enabled:
            # We pass complete notification details including database ID
            data_with_id = (data or {}).copy()
            data_with_id["id"] = notification.id
            data_with_id["type"] = notification_type
            await CHANNELS["in_app"].send(user_id, title, message, data_with_id)

        if email_enabled:
            await CHANNELS["email"].send(user_id, title, message, data)

        if push_enabled:
            await CHANNELS["push"].send(user_id, title, message, data)

        return notification

    async def get_user_notifications(
        self, 
        user_id: int, 
        limit: int = 20, 
        offset: int = 0
    ) -> List[Notification]:
        """Fetch notifications logs for a user, sorted by creation date."""
        query = (
            select(Notification)
            .where(Notification.user_id == user_id)
            .order_by(Notification.created_at.desc())
            .offset(offset)
            .limit(limit)
        )
        res = await self.db.execute(query)
        return list(res.scalars().all())

    async def mark_as_read(self, user_id: int, notification_id: int) -> bool:
        """Mark a specific user notification as read."""
        stmt = (
            update(Notification)
            .where(
                and_(
                    Notification.id == notification_id,
                    Notification.user_id == user_id
                )
            )
            .values(is_read=True)
        )
        res = await self.db.execute(stmt)
        return res.rowcount > 0

    async def mark_all_read(self, user_id: int) -> int:
        """Mark all unread notifications for a user as read."""
        stmt = (
            update(Notification)
            .where(
                and_(
                    Notification.user_id == user_id,
                    Notification.is_read == False
                )
            )
            .values(is_read=True)
        )
        res = await self.db.execute(stmt)
        return res.rowcount

    async def get_user_preferences(self, user_id: int) -> List[NotificationPreference]:
        """Fetch all notification delivery configurations for a user."""
        query = select(NotificationPreference).where(NotificationPreference.user_id == user_id)
        res = await self.db.execute(query)
        return list(res.scalars().all())

    async def update_preferences(
        self, 
        user_id: int, 
        notification_type: str, 
        email_enabled: Optional[bool] = None, 
        push_enabled: Optional[bool] = None, 
        in_app_enabled: Optional[bool] = None
    ) -> NotificationPreference:
        """Update or insert a channel preference configuration for a notification type."""
        query = select(NotificationPreference).where(
            and_(
                NotificationPreference.user_id == user_id,
                NotificationPreference.type == notification_type
            )
        )
        res = await self.db.execute(query)
        pref = res.scalar_one_or_none()

        if pref:
            if email_enabled is not None:
                pref.email_enabled = email_enabled
            if push_enabled is not None:
                pref.push_enabled = push_enabled
            if in_app_enabled is not None:
                pref.in_app_enabled = in_app_enabled
        else:
            pref = NotificationPreference(
                user_id=user_id,
                type=notification_type,
                email_enabled=email_enabled if email_enabled is not None else False,
                push_enabled=push_enabled if push_enabled is not None else False,
                in_app_enabled=in_app_enabled if in_app_enabled is not None else True
            )
            self.db.add(pref)

        await self.db.flush()
        return pref
