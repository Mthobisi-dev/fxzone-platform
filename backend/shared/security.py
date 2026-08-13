"""FxZone security utilities - JWT, password hashing, auth dependencies."""
import logging
from datetime import datetime, timedelta, timezone
from typing import Optional, List
from fastapi import Depends, HTTPException, status, WebSocket
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError, jwt
import bcrypt
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from config import settings
from shared.database import get_db

logger = logging.getLogger(__name__)

security_scheme = HTTPBearer(auto_error=False)


def hash_password(password: str) -> str:
    """Hash a plain-text password using bcrypt."""
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(password.encode("utf-8"), salt)
    return hashed.decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a plain-text password against a bcrypt hash."""
    try:
        return bcrypt.checkpw(
            plain_password.encode("utf-8"),
            hashed_password.encode("utf-8")
        )
    except Exception:
        return False


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """Create a JWT access token."""
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (
        expires_delta or timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    to_encode.update({"exp": expire, "type": "access"})
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def create_refresh_token(data: dict) -> str:
    """Create a JWT refresh token with longer expiry."""
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    to_encode.update({"exp": expire, "type": "refresh"})
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def verify_token(token: str) -> dict:
    """Verify and decode a JWT token. Supports both app local JWTs and Supabase JWTs."""
    # 1. Try decoding with our app secret key
    try:
        payload = jwt.decode(
            token, settings.SECRET_KEY, algorithms=[settings.JWT_ALGORITHM]
        )
        return payload
    except JWTError:
        pass

    # 2. Try decoding as a Supabase JWT
    try:
        # Check if Supabase secret is set
        if settings.SUPABASE_JWT_SECRET:
            payload = jwt.decode(
                token, settings.SUPABASE_JWT_SECRET, algorithms=["HS256"], options={"verify_aud": False}
            )
            return payload
        else:
            # If secret not set and we are in dev, decode without signature verification for ease of development
            if settings.APP_ENV == "development":
                payload = jwt.decode(
                    token, "", options={"verify_signature": False, "verify_aud": False}
                )
                logger.warning("Decoded Supabase JWT token without signature verification in local development.")
                return payload
    except Exception as e:
        logger.error(f"Failed to decode Supabase JWT: {e}")

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid or expired token",
        headers={"WWW-Authenticate": "Bearer"},
    )


class UserSession(dict):
    """Dictionary subclass supporting dot-notation attribute access and UUID id mapping."""
    @property
    def id(self):
        from uuid import UUID
        val = self.get("user_id")
        if isinstance(val, str):
            try:
                return UUID(val)
            except ValueError:
                return val
        return val

    def __getattr__(self, name):
        if name in self:
            return self[name]
        raise AttributeError(f"'UserSession' object has no attribute '{name}'")


async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security_scheme),
    db: AsyncSession = Depends(get_db),
):
    """FastAPI dependency to extract and validate the current user from JWT."""
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required",
            headers={"WWW-Authenticate": "Bearer"},
        )

    payload = verify_token(credentials.credentials)

    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token payload",
        )

    # Convert user_id string to uuid.UUID if applicable
    import uuid
    try:
        user_uuid = uuid.UUID(user_id)
    except ValueError:
        user_uuid = user_id

    # Check if user exists in local database
    from shared.models import User, UserRole
    result = await db.execute(select(User).where(User.id == user_uuid))
    user = result.scalar_one_or_none()

    if not user:
        # Auto-register/sync Supabase Google Auth user signing in for the first time
        email = payload.get("email")
        if not email:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Email claim required in token",
            )
            
        user_metadata = payload.get("user_metadata", {})
        display_name = user_metadata.get("full_name") or user_metadata.get("name") or email.split("@")[0]
        avatar_url = user_metadata.get("avatar_url") or user_metadata.get("picture")
        username = user_metadata.get("user_name") or user_metadata.get("username") or email.split("@")[0]
        
        # Ensure username is unique
        check_user = await db.execute(select(User).where(User.username == username))
        if check_user.scalar_one_or_none():
            username = f"{username}_{uuid.uuid4().hex[:6]}"

        user = User(
            id=user_uuid,
            email=email,
            username=username,
            display_name=display_name,
            avatar_url=avatar_url,
            password_hash="supabase_oauth_user",
            role=UserRole.trader,
            is_active=True
        )
        db.add(user)
        try:
            await db.commit()
            await db.refresh(user)
            logger.info(f"Automatically created local user for Supabase auth sub: {user_id}")
        except Exception as e:
            await db.rollback()
            logger.error(f"Failed to auto-create local user: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to sync authenticated user profile."
            )

    return UserSession({
        "user_id": str(user.id),
        "email": user.email,
        "role": user.role.value if hasattr(user.role, 'value') else user.role,
        "username": user.username,
        "display_name": user.display_name,
        "avatar_url": user.avatar_url,
        "bio": getattr(user, "bio", None),
        "is_active": getattr(user, "is_active", True),
        "followers_count": getattr(user, "followers_count", 0),
        "following_count": getattr(user, "following_count", 0),
        "created_at": getattr(user, "created_at", None),
    })


async def get_current_user_optional(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security_scheme),
    db: AsyncSession = Depends(get_db),
):
    """Optional auth - returns None if not authenticated."""
    if not credentials:
        return None
    try:
        return await get_current_user(credentials, db)
    except HTTPException:
        return None


def require_role(*allowed_roles: str):
    """Factory for role-based access control dependency."""
    async def role_checker(current_user: dict = Depends(get_current_user)):
        if current_user["role"] not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Role '{current_user['role']}' not authorized. Required: {allowed_roles}",
            )
        return current_user
    return role_checker


async def get_ws_user(websocket: WebSocket) -> Optional[dict]:
    """Extract user from WebSocket query parameter token."""
    token = websocket.query_params.get("token")
    if not token:
        return None
    try:
        payload = verify_token(token)
        user_id = payload.get("sub")
        if not user_id:
            return None
        return UserSession({
            "user_id": str(user_id),
            "email": payload.get("email", ""),
            "role": payload.get("role", "trader"),
            "username": payload.get("username", ""),
        })
    except HTTPException:
        return None
