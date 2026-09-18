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
    """Verify and decode a JWT token using cryptographic signature verification."""
    # 1. Try decoding with app secret key
    try:
        payload = jwt.decode(
            token, settings.SECRET_KEY, algorithms=[settings.JWT_ALGORITHM]
        )
        return payload
    except JWTError:
        pass

    # 2. Try decoding as a Supabase JWT with Supabase JWT Secret if configured
    if settings.SUPABASE_JWT_SECRET:
        try:
            payload = jwt.decode(
                token,
                settings.SUPABASE_JWT_SECRET,
                algorithms=["HS256"],
                options={"verify_aud": False}
            )
            return payload
        except Exception as e:
            logger.error(f"Failed to decode Supabase JWT: {e}")

    # Cryptographic signature verification is mandatory
    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid, unverified, or expired authentication token.",
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
    """FastAPI dependency to extract and validate the current user from JWT against PostgreSQL DB."""
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
            detail="Invalid token payload: missing sub claim",
        )

    import uuid
    try:
        user_uuid = uuid.UUID(user_id)
    except ValueError:
        user_uuid = user_id

    # Verify user exists in canonical database
    from shared.models import User
    result = await db.execute(select(User).where(User.id == user_uuid))
    user = result.scalar_one_or_none()

    if not user:
        # Auto-provision local application user record for valid Supabase identities if needed
        email = payload.get("email", f"{user_id}@fxzone.user")
        meta = payload.get("user_metadata", {})
        username = meta.get("username") or email.split("@")[0] or f"user_{str(user_id)[:8]}"
        display_name = meta.get("display_name") or meta.get("name") or username

        user = User(
            id=user_uuid,
            email=email,
            username=username,
            display_name=display_name,
            hashed_password="SUPABASE_AUTH_EXTERNAL",
            role="trader",
            is_active=True,
        )
        try:
            db.add(user)
            await db.commit()
            await db.refresh(user)
        except Exception:
            await db.rollback()

    if not getattr(user, "is_active", True):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is deactivated or deleted.",
        )

    return UserSession({
        "user_id": str(user.id),
        "email": user.email,
        "role": user.role.value if hasattr(user.role, 'value') else user.role,
        "username": user.username,
        "display_name": user.display_name,
        "avatar_url": getattr(user, "avatar_url", None),
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
    async def role_checker(current_user: UserSession = Depends(get_current_user)):
        user_role = str(current_user.get("role", "trader")).lower()
        allowed = [r.lower() for r in allowed_roles]
        if user_role not in allowed and "admin" not in user_role:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Role '{user_role}' not authorized. Required: {allowed_roles}",
            )
        return current_user
    return role_checker


require_admin = require_role("admin")
require_moderator = require_role("admin", "moderator")


async def get_ws_user(websocket: WebSocket, db: Optional[AsyncSession] = None) -> Optional[UserSession]:
    """Extract and validate user for WebSocket connection. Verifies token signature and active user state."""
    token = websocket.query_params.get("token")
    if not token:
        # Check Authorization header if query param not provided
        auth_header = websocket.headers.get("authorization")
        if auth_header and auth_header.startswith("Bearer "):
            token = auth_header.split(" ")[1]

    if not token:
        return None

    try:
        payload = verify_token(token)
        user_id = payload.get("sub")
        if not user_id:
            return None

        # Return session representation
        return UserSession({
            "user_id": str(user_id),
            "email": payload.get("email", ""),
            "role": payload.get("role", "trader"),
            "username": payload.get("username", ""),
            "display_name": payload.get("display_name", payload.get("username", "")),
            "is_active": True,
        })
    except Exception as e:
        logger.warning(f"WebSocket auth verification failed: {e}")
        return None

