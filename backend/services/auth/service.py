"""FxZone Auth Service - Business logic."""
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from shared.models import User
from shared.security import hash_password, verify_password, create_access_token, create_refresh_token, verify_token
from services.auth.schemas import UserCreate, UserLogin, UserUpdate
from fastapi import HTTPException, status


async def register_user(db: AsyncSession, data: UserCreate) -> User:
    """Register a new user."""
    # Check if email already exists
    result = await db.execute(select(User).where(User.email == data.email))
    if result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Email already registered")

    # Check if username already exists
    result = await db.execute(select(User).where(User.username == data.username))
    if result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Username already taken")

    # Validate role
    valid_roles = ["trader", "analyst", "verified_educator"]
    role = data.role if data.role in valid_roles else "trader"

    user = User(
        email=data.email,
        username=data.username,
        password_hash=hash_password(data.password),
        display_name=data.display_name or data.username,
        avatar_url=f"https://api.dicebear.com/8.x/initials/svg?seed={data.username}",
        role=role,
    )
    db.add(user)
    await db.flush()
    await db.refresh(user)
    return user


async def authenticate_user(db: AsyncSession, data: UserLogin) -> dict:
    """Authenticate a user and return tokens."""
    result = await db.execute(select(User).where(User.email == data.email))
    user = result.scalar_one_or_none()

    if not user or not verify_password(data.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    if not user.is_active:
        raise HTTPException(status_code=403, detail="Account is deactivated")

    token_data = {
        "sub": str(user.id),
        "email": user.email,
        "role": user.role.value if hasattr(user.role, 'value') else user.role,
        "username": user.username,
    }

    return {
        "access_token": create_access_token(token_data),
        "refresh_token": create_refresh_token(token_data),
        "user": user,
    }


async def refresh_tokens(db: AsyncSession, refresh_token: str) -> dict:
    """Generate new tokens from a valid refresh token."""
    payload = verify_token(refresh_token)

    if payload.get("type") != "refresh":
        raise HTTPException(status_code=401, detail="Invalid refresh token")

    user_id = payload.get("sub")
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    token_data = {
        "sub": str(user.id),
        "email": user.email,
        "role": user.role.value if hasattr(user.role, 'value') else user.role,
        "username": user.username,
    }

    return {
        "access_token": create_access_token(token_data),
        "refresh_token": create_refresh_token(token_data),
        "user": user,
    }


async def get_user_by_id(db: AsyncSession, user_id: str) -> User:
    """Get user by ID."""
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


async def update_user_profile(db: AsyncSession, user_id: str, data: UserUpdate) -> User:
    """Update user profile with uniqueness checks for username."""
    user = await get_user_by_id(db, user_id)

    if data.username is not None and data.username != user.username:
        # Check uniqueness
        existing = await db.execute(select(User).where(User.username == data.username))
        if existing.scalar_one_or_none():
            raise HTTPException(status_code=400, detail="Username already taken")
        user.username = data.username
    if data.display_name is not None:
        user.display_name = data.display_name
    if data.bio is not None:
        user.bio = data.bio
    if data.avatar_url is not None:
        user.avatar_url = data.avatar_url

    await db.flush()
    await db.refresh(user)
    return user
