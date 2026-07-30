"""FastAPI router for the FxZone Notifications service."""
import logging
from fastapi import APIRouter, Depends, HTTPException, Query, status, WebSocket, WebSocketDisconnect
from typing import List
from sqlalchemy.ext.asyncio import AsyncSession

from shared.database import get_db
from shared.security import get_current_user, get_ws_user
from shared.websocket_manager import manager
from shared.models import User
from services.notifications.service import NotificationService
from services.notifications.schemas import (
    NotificationResponse,
    NotificationPreferenceResponse,
    NotificationPreferenceUpdate
)

router = APIRouter(prefix="/api/notifications", tags=["Notifications"])

logger = logging.getLogger(__name__)


@router.get("", response_model=List[NotificationResponse])
async def get_user_notifications(
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Retrieve paginated historical in-app notifications for the authenticated user."""
    service = NotificationService(db)
    return await service.get_user_notifications(user_id=current_user.id, limit=limit, offset=offset)


@router.put("/{notification_id}/read", status_code=status.HTTP_200_OK)
async def mark_notification_read(
    notification_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Mark a specific notification log as read."""
    service = NotificationService(db)
    success = await service.mark_as_read(user_id=current_user.id, notification_id=notification_id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Notification not found or unauthorized."
        )
    return {"status": "success", "message": "Notification marked as read."}


@router.put("/read-all", status_code=status.HTTP_200_OK)
async def mark_all_notifications_read(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Mark all unread notifications of the current user as read."""
    service = NotificationService(db)
    read_count = await service.mark_all_read(user_id=current_user.id)
    return {
        "status": "success",
        "message": f"Successfully marked {read_count} notifications as read."
    }


@router.get("/preferences", response_model=List[NotificationPreferenceResponse])
async def get_delivery_preferences(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Fetch the delivery channel configurations (email, in-app, push) for each alert type."""
    service = NotificationService(db)
    return await service.get_user_preferences(user_id=current_user.id)


@router.put("/preferences", response_model=NotificationPreferenceResponse)
async def update_delivery_preferences(
    request: NotificationPreferenceUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Update or insert channel delivery rules for a notification type."""
    service = NotificationService(db)
    pref = await service.update_preferences(
        user_id=current_user.id,
        notification_type=request.type,
        email_enabled=request.email_enabled,
        push_enabled=request.push_enabled,
        in_app_enabled=request.in_app_enabled
    )
    return pref


@router.websocket("/ws/notifications")
async def notifications_websocket_endpoint(websocket: WebSocket):
    """WebSocket handler for streaming real-time in-app alerts directly to active traders."""
    user = await get_ws_user(websocket)
    if not user:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    user_id = str(user["user_id"])
    channel_name = f"user_notifications_{user_id}"

    # Register connection in shared connection manager
    await manager.connect(websocket, channel_name, str(user_id))

    try:
        while True:
            # We keep connection alive by waiting for client messages (like heartbeats)
            await websocket.receive_text()
    except WebSocketDisconnect:
        await manager.disconnect(websocket, channel_name)
    except Exception as e:
        logger.error(f"Notifications websocket exception for user {user_id}: {e}")
        await manager.disconnect(websocket, channel_name)
