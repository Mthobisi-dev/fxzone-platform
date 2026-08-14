"""Pydantic schemas for the FxZone Chat system."""
from pydantic import BaseModel, Field, ConfigDict
from pydantic.alias_generators import to_camel
from typing import List, Optional, Union
from datetime import datetime
from uuid import UUID
from services.social.schemas import UserShort, camel_model


class ConversationCreate(BaseModel):
    """Schema to create a new DM or group chat room."""
    name: Optional[str] = Field(None, max_length=100, description="Optional name of the conversation (mostly for group chats).")
    is_group: bool = Field(False, description="Flag indicating if this is a group chat or 1:1 DM.")
    participant_ids: Optional[List[str]] = Field(None, description="List of participant user IDs to include.")
    username: Optional[str] = Field(None, description="Optional username to start 1:1 DM directly by username.")


class ConversationResponse(camel_model):
    """Schema representing a chat conversation folder."""
    id: Union[UUID, str]
    name: Optional[str] = None
    description: Optional[str] = None
    is_group: bool
    creator_id: Optional[Union[UUID, str]] = None
    created_at: datetime
    updated_at: datetime
    members: List[UserShort] = []


class MessageCreate(BaseModel):
    """Schema to send a chat message."""
    content: str = Field(..., max_length=2000, description="Message text content.")
    message_type: str = Field("text", description="Type of message: 'text', 'image', 'system'.")


class MessageResponse(camel_model):
    """Schema representing an individual message in a chat history."""
    id: Union[UUID, str]
    conversation_id: Union[UUID, str]
    sender_id: Union[UUID, str]
    sender: UserShort
    content: str
    message_type: str
    created_at: datetime

