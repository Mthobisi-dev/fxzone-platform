"""Request bodies. Unknown fields are ignored (the frontend sends a few extras); limits are enforced here."""
from __future__ import annotations

import re
import uuid
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

_URL = re.compile(r"^https?://[^\s]{1,2040}$", re.I)
_USERNAME = re.compile(r"^[A-Za-z0-9_]{3,30}$")


def _check_url(v: str | None) -> str | None:
    if v is None or v == "":
        return None
    if not _URL.match(v):
        raise ValueError("must be an http(s) URL")
    return v


class Base(BaseModel):
    model_config = ConfigDict(extra="ignore", str_strip_whitespace=True)


class PostCreate(Base):
    content: str = Field(default="", max_length=5000)
    image_url: str | None = None
    caption: str | None = Field(default=None, max_length=500)
    asset_tags: list[str] = Field(default_factory=list, max_length=20)
    is_story: bool = False
    show_comments_count: bool = True
    show_likes_count: bool = True
    allow_reshare: bool = True
    allow_save: bool = True
    allow_share: bool = True

    _url = field_validator("image_url")(_check_url)

    @model_validator(mode="after")
    def _need_something(self):
        if not self.content and not self.image_url and not self.is_story:
            raise ValueError("Content is required")
        return self


class StoryCreate(PostCreate):
    is_story: bool = True


class CommentCreate(Base):
    content: str = Field(min_length=1, max_length=2000)
    parent_id: uuid.UUID | None = None


class ReactBody(Base):
    reaction_type: Literal["like", "love", "fire", "bullish", "bearish"] = "like"


DEFAULT_BROKER = "Exness"
_NO_CONTROL_CHARS = re.compile(r"^[^\x00-\x1f\x7f]+$")


class ProfileUpdate(Base):
    username: str | None = None
    display_name: str | None = Field(default=None, max_length=100)
    bio: str | None = Field(default=None, max_length=500)
    avatar_url: str | None = None
    preferred_broker: str | None = Field(default=None, max_length=100)

    _url = field_validator("avatar_url")(_check_url)

    @field_validator("preferred_broker")
    @classmethod
    def _broker(cls, v):
        """Free text on purpose (the UI's broker list can grow without a backend deploy); an empty value resets to the default."""
        if v is None:
            return None
        if not v:
            return DEFAULT_BROKER
        if not _NO_CONTROL_CHARS.match(v):
            raise ValueError("must not contain control characters")
        return v

    @field_validator("username")
    @classmethod
    def _username(cls, v):
        if v is not None and not _USERNAME.match(v):
            raise ValueError("3-30 characters: letters, numbers and underscores only")
        return v


class UserActionBody(Base):
    """POST /api/social/users: legacy 'follow by body' or admin 'add trader' (the latter is unsupported)."""
    following_id: uuid.UUID | None = None
    username: str | None = None


class ConversationCreate(Base):
    participant_ids: list[uuid.UUID] = Field(default_factory=list, max_length=50)
    username: str | None = Field(default=None, max_length=50)
    usernames: list[str] = Field(default_factory=list, max_length=50)
    is_group: bool = False
    name: str | None = Field(default=None, max_length=100)
    description: str | None = Field(default=None, max_length=500)


class ConversationUpdate(Base):
    name: str | None = Field(default=None, min_length=1, max_length=100)
    description: str | None = Field(default=None, max_length=500)


class MembersAdd(Base):
    user_ids: list[uuid.UUID] = Field(default_factory=list, max_length=50)
    usernames: list[str] = Field(default_factory=list, max_length=50)


class MessageCreate(Base):
    content: str = Field(min_length=1, max_length=4000)
    message_type: Literal["text", "image", "audio", "video", "file", "system"] = "text"


class SessionCreate(Base):
    title: str = Field(min_length=1, max_length=200)
    description: str = Field(default="", max_length=2000)
    session_type: Literal["public", "private", "invite_only"] = "public"
    max_participants: int | None = Field(default=None, ge=1, le=1000)
    requires_approval: bool | None = None


class WatchlistBody(Base):
    name: str = Field(default="My Watchlist", min_length=1, max_length=100)


class WatchlistItemBody(Base):
    asset_id: str | None = Field(default=None, max_length=64)
    symbol: str | None = Field(default=None, max_length=20)

    @model_validator(mode="after")
    def _one(self):
        if not (self.asset_id or self.symbol):
            raise ValueError("asset_id or symbol required")
        return self


class NotificationsMark(Base):
    ids: list[uuid.UUID] | None = None


class AiChatBody(Base):
    message: str | None = Field(default=None, max_length=2000)
    prompt: str | None = Field(default=None, max_length=2000)
    conversation_id: str | None = Field(default=None, max_length=64)

    @property
    def text(self) -> str:
        return (self.message or self.prompt or "").strip()
