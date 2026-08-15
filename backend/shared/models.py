"""FxZone SQLAlchemy ORM models."""
import uuid
import enum
from datetime import datetime, timezone
from sqlalchemy import (
    Column, String, Text, Boolean, Integer, Float, DateTime,
    ForeignKey, JSON, Enum, UniqueConstraint, CheckConstraint, Index, Table
)
from sqlalchemy import Uuid
from sqlalchemy.types import TypeDecorator

class GUID(TypeDecorator):
    """Platform-independent GUID type.
    Uses PostgreSQL's UUID type, otherwise CHAR(32), storing as uuid.UUID objects.
    """
    impl = Uuid
    cache_ok = True

    def process_bind_param(self, value, dialect):
        if value is None:
            return value
        if isinstance(value, uuid.UUID):
            return value
        if isinstance(value, str):
            clean_val = value.replace("-", "")
            try:
                return uuid.UUID(clean_val)
            except ValueError:
                return value
        return value

    def process_result_value(self, value, dialect):
        if value is None:
            return value
        if isinstance(value, uuid.UUID):
            return value
        try:
            return uuid.UUID(value)
        except ValueError:
            return value

UUID = GUID
from sqlalchemy.orm import relationship
from shared.database import Base


def utcnow():
    return datetime.now(timezone.utc)


# ============================================================
# ENUMS
# ============================================================
class UserRole(str, enum.Enum):
    trader = "trader"
    analyst = "analyst"
    admin = "admin"
    verified_educator = "verified_educator"


class AssetType(str, enum.Enum):
    forex = "forex"
    stock = "stock"
    crypto = "crypto"


class SessionType(str, enum.Enum):
    public = "public"
    private = "private"
    invite_only = "invite_only"


class SessionStatus(str, enum.Enum):
    scheduled = "scheduled"
    live = "live"
    ended = "ended"


class ExperienceLevel(str, enum.Enum):
    beginner = "beginner"
    intermediate = "intermediate"
    advanced = "advanced"
    expert = "expert"


class ParticipantRole(str, enum.Enum):
    host = "host"
    viewer = "viewer"
    co_host = "co_host"
    pending = "pending"


# ============================================================
# USER
# ============================================================
class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String(255), unique=True, nullable=False, index=True)
    username = Column(String(50), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    display_name = Column(String(100))
    avatar_url = Column(Text)
    bio = Column(Text)
    role = Column(Enum(UserRole, name="user_role", create_type=False), default=UserRole.trader)
    is_active = Column(Boolean, default=True)
    followers_count = Column(Integer, default=0)
    following_count = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), default=utcnow)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    # Relationships
    posts = relationship("Post", back_populates="user", lazy="dynamic")
    watchlists = relationship("Watchlist", back_populates="user", lazy="dynamic")


# ============================================================
# ASSET
# ============================================================
class Asset(Base):
    __tablename__ = "assets"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    symbol = Column(String(20), unique=True, nullable=False, index=True)
    name = Column(String(100), nullable=False)
    asset_type = Column(Enum(AssetType, name="asset_type", create_type=False), nullable=False)
    description = Column(Text)
    logo_url = Column(Text)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), default=utcnow)


# ============================================================
# WATCHLIST
# ============================================================
class Watchlist(Base):
    __tablename__ = "watchlists"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(100), nullable=False, default="My Watchlist")
    created_at = Column(DateTime(timezone=True), default=utcnow)

    user = relationship("User", back_populates="watchlists")
    items = relationship("WatchlistItem", back_populates="watchlist", cascade="all, delete-orphan")


class WatchlistItem(Base):
    __tablename__ = "watchlist_items"
    __table_args__ = (UniqueConstraint("watchlist_id", "asset_id"),)

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    watchlist_id = Column(UUID(as_uuid=True), ForeignKey("watchlists.id", ondelete="CASCADE"), nullable=False)
    asset_id = Column(UUID(as_uuid=True), ForeignKey("assets.id", ondelete="CASCADE"), nullable=False)
    added_at = Column(DateTime(timezone=True), default=utcnow)

    watchlist = relationship("Watchlist", back_populates="items")
    asset = relationship("Asset")


# ============================================================
# POST (Social)
# ============================================================
# Association Table for Post Asset Tags (4NF Many-to-Many)
post_asset_tags = Table(
    "post_asset_tags",
    Base.metadata,
    Column("post_id", UUID(as_uuid=True), ForeignKey("posts.id", ondelete="CASCADE"), primary_key=True),
    Column("asset_id", UUID(as_uuid=True), ForeignKey("assets.id", ondelete="CASCADE"), primary_key=True),
)


class Post(Base):
    __tablename__ = "posts"
    __table_args__ = (
        Index('ix_posts_user_created', 'user_id', 'created_at'),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    content = Column(Text, nullable=False)
    image_url = Column(Text)
    likes_count = Column(Integer, default=0)
    comments_count = Column(Integer, default=0)
    reposts_count = Column(Integer, default=0)
    is_story = Column(Boolean, default=False)
    is_pinned = Column(Boolean, default=False)
    show_comments_count = Column(Boolean, default=True)
    show_likes_count = Column(Boolean, default=True)
    allow_reshare = Column(Boolean, default=True)
    allow_save = Column(Boolean, default=True)
    allow_share = Column(Boolean, default=True)
    expires_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=utcnow)

    # 4NF Many-to-many relationship
    tagged_assets = relationship("Asset", secondary=post_asset_tags, lazy="selectin")

    @property
    def asset_tags(self) -> list[str]:
        return [asset.symbol for asset in self.tagged_assets]

    user = relationship("User", back_populates="posts")
    comments = relationship("Comment", back_populates="post", cascade="all, delete-orphan")
    reactions = relationship("Reaction", back_populates="post", cascade="all, delete-orphan")


# ============================================================
# COMMENT
# ============================================================
class Comment(Base):
    __tablename__ = "comments"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    post_id = Column(UUID(as_uuid=True), ForeignKey("posts.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    content = Column(Text, nullable=False)
    parent_id = Column(UUID(as_uuid=True), ForeignKey("comments.id", ondelete="CASCADE"), nullable=True)
    created_at = Column(DateTime(timezone=True), default=utcnow)

    post = relationship("Post", back_populates="comments")
    user = relationship("User")
    parent = relationship("Comment", remote_side=[id], back_populates="replies")
    replies = relationship("Comment", back_populates="parent", cascade="all, delete-orphan")


# ============================================================
# REACTION
# ============================================================
class Reaction(Base):
    __tablename__ = "reactions"
    # Unique per user + post + reaction_type so a user can both 'like' AND 'repost' the same post
    __table_args__ = (UniqueConstraint("user_id", "post_id", "reaction_type", name="uq_reaction_user_post_type"),)

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    post_id = Column(UUID(as_uuid=True), ForeignKey("posts.id", ondelete="CASCADE"), nullable=False)
    reaction_type = Column(String(20), default="like", nullable=False)
    created_at = Column(DateTime(timezone=True), default=utcnow)

    post = relationship("Post", back_populates="reactions")
    user = relationship("User")


# ============================================================
# BOOKMARK (Saved Posts)
# ============================================================
class Bookmark(Base):
    __tablename__ = "bookmarks"
    __table_args__ = (UniqueConstraint("user_id", "post_id"),)

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    post_id = Column(UUID(as_uuid=True), ForeignKey("posts.id", ondelete="CASCADE"), nullable=False)
    created_at = Column(DateTime(timezone=True), default=utcnow)

    post = relationship("Post")
    user = relationship("User")


# ============================================================
# FOLLOW
# ============================================================
class Follow(Base):
    __tablename__ = "follows"
    __table_args__ = (
        UniqueConstraint("follower_id", "following_id"),
        CheckConstraint("follower_id != following_id"),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    follower_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    following_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    created_at = Column(DateTime(timezone=True), default=utcnow)

    follower = relationship("User", foreign_keys=[follower_id])
    following = relationship("User", foreign_keys=[following_id])


# ============================================================
# CONVERSATION (Chat)
# ============================================================
class Conversation(Base):
    __tablename__ = "conversations"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(100), nullable=True)
    description = Column(Text, nullable=True)
    is_group = Column(Boolean, default=False)
    creator_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=True)
    created_at = Column(DateTime(timezone=True), default=utcnow)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    creator = relationship("User", foreign_keys=[creator_id], lazy="joined")
    members = relationship("ConversationMember", back_populates="conversation", cascade="all, delete-orphan", lazy="selectin")
    messages = relationship("Message", back_populates="conversation", cascade="all, delete-orphan")


class ConversationMember(Base):
    __tablename__ = "conversation_members"
    __table_args__ = (
        UniqueConstraint("conversation_id", "user_id"),
        Index('ix_conv_members_user', 'user_id'),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    conversation_id = Column(UUID(as_uuid=True), ForeignKey("conversations.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    joined_at = Column(DateTime(timezone=True), default=utcnow)
    last_read_at = Column(DateTime(timezone=True), default=utcnow)

    conversation = relationship("Conversation", back_populates="members")
    user = relationship("User", lazy="joined")


# ============================================================
# MESSAGE
# ============================================================
class Message(Base):
    __tablename__ = "messages"
    __table_args__ = (
        Index('ix_messages_conv_created', 'conversation_id', 'created_at'),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    conversation_id = Column(UUID(as_uuid=True), ForeignKey("conversations.id", ondelete="CASCADE"), nullable=False)
    sender_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    content = Column(Text, nullable=False)
    message_type = Column(String(20), default="text")
    created_at = Column(DateTime(timezone=True), default=utcnow)

    conversation = relationship("Conversation", back_populates="messages")
    sender = relationship("User")


# ============================================================
# LIVE SESSION
# ============================================================
class LiveSession(Base):
    __tablename__ = "live_sessions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    host_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    title = Column(String(200), nullable=False)
    description = Column(Text)
    session_type = Column(Enum(SessionType, name="session_type_enum", create_type=False), default=SessionType.public)
    status = Column(Enum(SessionStatus, name="session_status_enum", create_type=False), default=SessionStatus.scheduled)
    max_participants = Column(Integer, default=100)
    requires_approval = Column(Boolean, default=True)
    viewer_count = Column(Integer, default=0)
    started_at = Column(DateTime(timezone=True), nullable=True)
    ended_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=utcnow)

    host = relationship("User")
    participants = relationship("SessionParticipant", back_populates="session", cascade="all, delete-orphan")


class SessionParticipant(Base):
    __tablename__ = "session_participants"
    __table_args__ = (UniqueConstraint("session_id", "user_id"),)

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    session_id = Column(UUID(as_uuid=True), ForeignKey("live_sessions.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    role = Column(Enum(ParticipantRole, name="participant_role", create_type=False), default=ParticipantRole.viewer)
    joined_at = Column(DateTime(timezone=True), default=utcnow)
    left_at = Column(DateTime(timezone=True), nullable=True)

    session = relationship("LiveSession", back_populates="participants")
    user = relationship("User")


# ============================================================
# NOTIFICATION
# ============================================================
class Notification(Base):
    __tablename__ = "notifications"
    __table_args__ = (
        Index('ix_notifications_user_read', 'user_id', 'is_read', 'created_at'),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    type = Column(String(50), nullable=False)
    title = Column(String(200), nullable=False)
    message = Column(Text)
    data = Column(JSON, default=dict)
    is_read = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), default=utcnow)

    user = relationship("User")


class NotificationPreference(Base):
    __tablename__ = "notification_preferences"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False)
    in_app = Column(Boolean, default=True)
    email = Column(Boolean, default=False)
    push = Column(Boolean, default=True)
    news_alerts = Column(Boolean, default=True)
    price_alerts = Column(Boolean, default=True)
    social_alerts = Column(Boolean, default=True)
    session_alerts = Column(Boolean, default=True)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)


# ============================================================
# ML / PERSONALIZATION
# ============================================================
class UserBehaviorEvent(Base):
    __tablename__ = "user_behavior_events"
    __table_args__ = (
        Index('ix_behavior_user_type', 'user_id', 'event_type'),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    event_type = Column(String(50), nullable=False)
    target_type = Column(String(50))
    target_id = Column(String(100))
    event_metadata = Column("metadata", JSON, default=dict)
    created_at = Column(DateTime(timezone=True), default=utcnow)


class UserCategoryPreference(Base):
    __tablename__ = "user_category_preferences"
    __table_args__ = (UniqueConstraint("user_id", "category_name"),)

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    category_name = Column(String(50), nullable=False)
    preference_value = Column(Float, nullable=False, default=0.0)


class UserPreferenceVector(Base):
    __tablename__ = "user_preference_vectors"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False)
    risk_preference = Column(Float, default=0.5)
    experience_level = Column(
        Enum(ExperienceLevel, name="experience_level", create_type=False),
        default=ExperienceLevel.beginner,
    )
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    # 4NF Category Preferences relationship
    category_preferences = relationship(
        "UserCategoryPreference",
        primaryjoin="UserPreferenceVector.user_id == UserCategoryPreference.user_id",
        foreign_keys="UserCategoryPreference.user_id",
        cascade="all, delete-orphan",
        lazy="selectin"
    )

    @property
    def vector(self) -> dict[str, float]:
        return {pref.category_name: pref.preference_value for pref in self.category_preferences}

    @vector.setter
    def vector(self, val: dict[str, float]):
        self.category_preferences = [
            UserCategoryPreference(category_name=cat, preference_value=v)
            for cat, v in val.items()
        ]
