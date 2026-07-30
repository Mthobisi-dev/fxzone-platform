"""Pydantic schemas for the FxZone Notifications service."""
from pydantic import BaseModel, Field
from typing import Optional, Dict, Any
from datetime import datetime


class NotificationResponse(BaseModel):
    """Schema representing an in-app user notification."""
    id: str
    user_id: str
    type: str = Field(..., description="Notification type: 'market', 'news', 'social', 'system'.")
    title: str
    message: str
    data: Optional[Dict[str, Any]] = None
    is_read: bool
    created_at: datetime

    class Config:
        from_attributes = True


class NotificationPreferenceResponse(BaseModel):
    """Schema representing user channel delivery preferences."""
    type: str
    email_enabled: bool
    push_enabled: bool
    in_app_enabled: bool

    class Config:
        from_attributes = True


class NotificationPreferenceUpdate(BaseModel):
    """Schema to update user delivery preferences."""
    type: str
    email_enabled: Optional[bool] = None
    push_enabled: Optional[bool] = None
    in_app_enabled: Optional[bool] = None
