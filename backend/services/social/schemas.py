"""Pydantic schemas for the FxZone Social Trading network."""
from pydantic import BaseModel, Field, ConfigDict, model_validator
from pydantic.alias_generators import to_camel
from typing import List, Optional, Union, Any
from datetime import datetime
from uuid import UUID


class camel_model(BaseModel):
    """Base model that serializes field names as camelCase for JSON APIs."""
    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        from_attributes=True
    )

    def model_dump(self, **kwargs):
        kwargs.setdefault('by_alias', True)
        return super().model_dump(**kwargs)

    def model_dump_json(self, **kwargs):
        kwargs.setdefault('by_alias', True)
        return super().model_dump_json(**kwargs)


class UserShort(camel_model):
    """Compact user model representation for feeds and comments."""
    id: Union[UUID, str]
    user_id: Optional[Union[UUID, str]] = None
    username: str
    display_name: Optional[str] = None
    avatar_url: Optional[str] = None
    role: str

    @model_validator(mode='before')
    @classmethod
    def populate_user_id(cls, data: Any) -> Any:
        if isinstance(data, dict):
            if 'id' in data and not data.get('user_id'):
                data['user_id'] = data['id']
        elif hasattr(data, 'id'):
            if not hasattr(data, 'user_id') or getattr(data, 'user_id') is None:
                setattr(data, 'user_id', getattr(data, 'id'))
        return data


class PostCreate(BaseModel):
    """Schema to create a new feed post or story."""
    content: str = Field(..., max_length=1000, description="The textual content of the post.")
    image_url: Optional[str] = Field(None, description="Optional image/chart URL attached to the post.")
    asset_tags: List[str] = Field(default_factory=list, description="Assets tagged in this post, e.g. ['BTCUSD'].")
    is_story: bool = Field(False, description="Whether this is a 24h expiring story.")


class PostResponse(camel_model):
    """Schema representing a post in the feed."""
    id: Union[UUID, str]
    user_id: Union[UUID, str]
    user: UserShort
    content: str
    image_url: Optional[str] = None
    asset_tags: Optional[List[str]] = []
    likes_count: int
    comments_count: int
    reposts_count: int
    is_story: bool
    is_pinned: Optional[bool] = False
    expires_at: Optional[datetime] = None
    created_at: datetime
    is_liked_by_user: Optional[bool] = False
    is_reposted_by_user: Optional[bool] = False
    is_bookmarked_by_user: Optional[bool] = False


class CommentCreate(BaseModel):
    """Schema to add a comment to a post."""
    content: str = Field(..., max_length=500, description="Comment message content.")
    parent_id: Optional[str] = Field(None, description="Parent comment ID for nested threads.")


class CommentResponse(camel_model):
    """Schema representing a comment on a post."""
    id: Union[UUID, str]
    post_id: Union[UUID, str]
    user_id: Union[UUID, str]
    user: UserShort
    content: str
    parent_id: Optional[Union[UUID, str]] = None
    created_at: datetime


class ReactionRequest(BaseModel):
    """Schema to toggle a reaction on a post."""
    reaction_type: str = Field("like", description="Reaction type, currently 'like'.")


class ReactionResponse(camel_model):
    """Schema response for post reactions."""
    post_id: Union[UUID, str]
    reaction_type: str
    active: bool
    likes_count: int


class FollowResponse(camel_model):
    """Schema response for follow operations."""
    follower_id: Union[UUID, str]
    following_id: Union[UUID, str]
    is_following: bool
    followers_count: int
    following_count: int


class UserProfileResponse(camel_model):
    """Schema containing user profile data, bio, and social stats."""
    id: Union[UUID, str]
    username: str
    display_name: Optional[str] = None
    avatar_url: Optional[str] = None
    bio: Optional[str] = None
    role: str
    created_at: datetime
    followers_count: int
    following_count: int
    posts_count: int
    is_following: bool = False
