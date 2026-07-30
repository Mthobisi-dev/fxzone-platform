"""Pydantic schemas for the FxZone Live Trading Sessions service."""
from pydantic import BaseModel, Field, ConfigDict
from pydantic.alias_generators import to_camel
from typing import List, Optional, Union
from datetime import datetime
from uuid import UUID
from services.social.schemas import UserShort, camel_model


class LiveSessionCreate(BaseModel):
    """Schema to schedule or start a live screen-sharing session."""
    title: str = Field(..., max_length=150, description="Title of the trading session.")
    description: Optional[str] = Field(None, max_length=500, description="Description of topics covered.")
    session_type: str = Field("public", description="Session visibility: 'public', 'private', 'invite_only'.")
    max_participants: int = Field(50, ge=2, le=500, description="Max number of allowed simultaneous viewers.")
    requires_approval: bool = Field(True, description="If True, participants must be approved by the host before joining.")


class LiveSessionResponse(camel_model):
    """Schema representing an active or scheduled live session."""
    id: Union[UUID, str]
    host_id: Union[UUID, str]
    host: UserShort
    title: str
    description: Optional[str] = None
    session_type: str
    status: str
    max_participants: int
    participants_count: int = 0
    requires_approval: bool = True
    started_at: Optional[datetime] = None
    ended_at: Optional[datetime] = None
    created_at: datetime


class ParticipantResponse(camel_model):
    """Schema representing a viewer or co-host participating in a live session."""
    id: Union[UUID, str]
    session_id: Union[UUID, str]
    user_id: Union[UUID, str]
    user: UserShort
    role: str
    joined_at: datetime
    left_at: Optional[datetime] = None

