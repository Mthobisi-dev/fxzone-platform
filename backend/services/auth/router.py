"""FxZone Auth Service - API Router."""
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from shared.database import get_db
from shared.security import get_current_user
from services.auth.schemas import (
    UserCreate, UserLogin, UserUpdate, UserResponse, TokenResponse, RefreshRequest
)
from services.auth import service

router = APIRouter(prefix="/api/auth", tags=["Authentication"])


@router.post("/register", response_model=TokenResponse, status_code=201)
async def register(data: UserCreate, db: AsyncSession = Depends(get_db)):
    """Register a new user account."""
    user = await service.register_user(db, data)
    auth = await service.authenticate_user(db, UserLogin(email=data.email, password=data.password))
    return TokenResponse(
        access_token=auth["access_token"],
        refresh_token=auth["refresh_token"],
        user=UserResponse(
            id=str(user.id), email=user.email, username=user.username,
            display_name=user.display_name, avatar_url=user.avatar_url,
            bio=user.bio, role=user.role.value if hasattr(user.role, 'value') else user.role,
            is_active=user.is_active, followers_count=user.followers_count,
            following_count=user.following_count, created_at=user.created_at,
        ),
    )


@router.post("/login", response_model=TokenResponse)
async def login(data: UserLogin, db: AsyncSession = Depends(get_db)):
    """Login with email and password."""
    auth = await service.authenticate_user(db, data)
    user = auth["user"]
    return TokenResponse(
        access_token=auth["access_token"],
        refresh_token=auth["refresh_token"],
        user=UserResponse(
            id=str(user.id), email=user.email, username=user.username,
            display_name=user.display_name, avatar_url=user.avatar_url,
            bio=user.bio, role=user.role.value if hasattr(user.role, 'value') else user.role,
            is_active=user.is_active, followers_count=user.followers_count,
            following_count=user.following_count, created_at=user.created_at,
        ),
    )


@router.post("/refresh", response_model=TokenResponse)
async def refresh(data: RefreshRequest, db: AsyncSession = Depends(get_db)):
    """Refresh access token using refresh token."""
    auth = await service.refresh_tokens(db, data.refresh_token)
    user = auth["user"]
    return TokenResponse(
        access_token=auth["access_token"],
        refresh_token=auth["refresh_token"],
        user=UserResponse(
            id=str(user.id), email=user.email, username=user.username,
            display_name=user.display_name, avatar_url=user.avatar_url,
            bio=user.bio, role=user.role.value if hasattr(user.role, 'value') else user.role,
            is_active=user.is_active, followers_count=user.followers_count,
            following_count=user.following_count, created_at=user.created_at,
        ),
    )


@router.get("/me", response_model=UserResponse)
async def get_me(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get current authenticated user's profile."""
    user = await service.get_user_by_id(db, current_user["user_id"])
    return UserResponse(
        id=str(user.id), email=user.email, username=user.username,
        display_name=user.display_name, avatar_url=user.avatar_url,
        bio=user.bio, role=user.role.value if hasattr(user.role, 'value') else user.role,
        is_active=user.is_active, followers_count=user.followers_count,
        following_count=user.following_count, created_at=user.created_at,
    )


@router.put("/me", response_model=UserResponse)
async def update_me(
    data: UserUpdate,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update current user's profile."""
    user = await service.update_user_profile(db, current_user["user_id"], data)
    return UserResponse(
        id=str(user.id), email=user.email, username=user.username,
        display_name=user.display_name, avatar_url=user.avatar_url,
        bio=user.bio, role=user.role.value if hasattr(user.role, 'value') else user.role,
        is_active=user.is_active, followers_count=user.followers_count,
        following_count=user.following_count, created_at=user.created_at,
    )
