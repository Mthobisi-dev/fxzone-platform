"""Authentication & authorisation.

* Supabase Auth is the single identity authority. Tokens are verified cryptographically:
    - HS256 only when SUPABASE_JWT_SECRET is configured (legacy projects),
    - RS256/ES256 via the project's JWKS otherwise.
  The algorithm is chosen from an allow-list per token — never trusted blindly ("alg confusion"),
  and `none` is rejected.
* Authorisation (role, is_active) comes from public.users in the database, NEVER from token metadata.
"""
from __future__ import annotations

import asyncio
import logging
import re
import uuid
from dataclasses import dataclass
from typing import Any

import asyncpg
import jwt
from fastapi import Depends, Request
from jwt import PyJWKClient
from jwt.exceptions import PyJWKClientConnectionError, PyJWKClientError

from .cache import Cache
from .config import Settings
from .db import Database
from .deps import get_cache, get_db, get_settings_dep
from .errors import Forbidden, TooManyRequests, Unauthorized, UpstreamUnavailable

log = logging.getLogger("fxzone.security")

_ASYMMETRIC = {"RS256", "ES256"}
PROFILE_CACHE_TTL = 20  # seconds; bounds how long a role change / deactivation takes to propagate


@dataclass(slots=True)
class CurrentUser:
    id: uuid.UUID
    email: str | None
    username: str
    display_name: str | None
    avatar_url: str | None
    role: str
    is_active: bool = True

    @property
    def is_admin(self) -> bool:
        return self.role == "admin"

    @property
    def sid(self) -> str:
        return str(self.id)


class TokenVerifier:
    def __init__(self, settings: Settings) -> None:
        self._s = settings
        self._jwks: PyJWKClient | None = None
        if settings.supabase_url:
            self._jwks = PyJWKClient(f"{settings.supabase_url}/auth/v1/.well-known/jwks.json",
                                     cache_keys=True, lifespan=3600, timeout=5)

    async def verify(self, token: str) -> dict[str, Any]:
        try:
            header = jwt.get_unverified_header(token)
        except jwt.PyJWTError:
            raise Unauthorized("Invalid authentication token") from None
        alg = header.get("alg")

        if alg == "HS256":
            if not self._s.supabase_jwt_secret:
                raise Unauthorized("Invalid authentication token")
            key: Any = self._s.supabase_jwt_secret
        elif alg in _ASYMMETRIC:
            if self._jwks is None:
                raise Unauthorized("Invalid authentication token")
            try:
                signing_key = await asyncio.to_thread(self._jwks.get_signing_key_from_jwt, token)
            except PyJWKClientConnectionError:
                log.error("cannot reach Supabase JWKS endpoint")
                raise UpstreamUnavailable("Authentication service temporarily unavailable") from None
            except (PyJWKClientError, jwt.PyJWTError):
                raise Unauthorized("Invalid authentication token") from None
            key = signing_key.key
        else:
            raise Unauthorized("Invalid authentication token")

        try:
            claims = jwt.decode(
                token, key, algorithms=[alg],
                audience=self._s.supabase_jwt_audience,
                issuer=self._s.supabase_auth_issuer,
                leeway=10,
                options={"require": ["exp", "sub"], "verify_iss": bool(self._s.supabase_auth_issuer)},
            )
        except jwt.ExpiredSignatureError:
            raise Unauthorized("Token expired") from None
        except (jwt.PyJWTError, TypeError, ValueError):
            # TypeError/ValueError: header `alg` does not match the type of the key the `kid` resolved to
            # (e.g. alg=ES256 pointing at an RSA JWK). That is a bad token, never a server error.
            raise Unauthorized("Invalid authentication token") from None

        try:
            uuid.UUID(str(claims["sub"]))
        except ValueError:
            raise Unauthorized("Invalid authentication token") from None
        return claims


_USER_COLS = "id, email, username, display_name, avatar_url, role::text AS role, is_active"


def _slug(value: str | None) -> str:
    return re.sub(r"[^a-z0-9_]", "", (value or "").lower())[:24]


async def provision_profile(db: Database, claims: dict[str, Any]) -> dict[str, Any] | None:
    """Create public.users for an authenticated Supabase user if the DB trigger has not.
    Role is ALWAYS 'trader' (metadata is user-controlled). Returns None if the auth user no longer exists."""
    uid = uuid.UUID(str(claims["sub"]))
    meta = claims.get("user_metadata") or {}
    email = claims.get("email") or f"{uid}@fxzone.local"
    base = _slug(meta.get("username")) or _slug(meta.get("name")) or _slug(email.split("@")[0]) or "trader"
    display = (meta.get("display_name") or meta.get("full_name") or meta.get("name") or base)[:100]
    avatar = meta.get("avatar_url") or meta.get("picture")
    broker = meta.get("preferred_broker")
    broker = broker.strip()[:100] if isinstance(broker, str) and broker.strip() else "Exness"
    hexid = uid.hex
    for n in (6, 10, 32):
        username = f"{base}_{hexid[:n]}"
        try:
            await db.execute(
                """INSERT INTO users (id, email, username, display_name, avatar_url, preferred_broker, role, is_active)
                   VALUES ($1, $2, $3, $4, $5, $6, 'trader', true) ON CONFLICT (id) DO NOTHING""",
                uid, email, username, display, avatar, broker)
            break
        except asyncpg.ForeignKeyViolationError:
            return None  # auth user was deleted while their JWT was still valid
        except asyncpg.UniqueViolationError:
            # username or email collision; re-check whether the row exists now, else retry longer suffix
            if await db.fetchval("SELECT 1 FROM users WHERE id = $1", uid):
                break
            continue
    return await db.fetchrow(f"SELECT {_USER_COLS} FROM users WHERE id = $1", uid)


async def _auth_fail_gate(request: Request, cache: Cache, settings: Settings) -> None:
    """Throttle repeated invalid-token attempts per client IP."""
    from .ratelimit import client_ip
    count, ttl = await cache.hit(f"authfail:{client_ip(request, settings)}", 60)
    if count > 30:
        raise TooManyRequests("Too many failed authentication attempts", headers={"Retry-After": str(ttl)})


async def _resolve_user(request: Request, token: str, db: Database, cache: Cache, settings: Settings) -> CurrentUser:
    verifier: TokenVerifier = request.app.state.verifier
    try:
        claims = await verifier.verify(token)
    except Unauthorized:
        await _auth_fail_gate(request, cache, settings)
        raise
    uid = str(claims["sub"])

    row = await cache.get_json(f"profile:{uid}")
    if row is None:
        row = await db.fetchrow(f"SELECT {_USER_COLS} FROM users WHERE id = $1", uuid.UUID(uid))
        if row is None:
            row = await provision_profile(db, claims)
            if row is None:
                raise Unauthorized("Account no longer exists")
        await cache.set_json(f"profile:{uid}", {**row, "id": str(row["id"])}, PROFILE_CACHE_TTL)

    if not row.get("is_active", True):
        raise Forbidden("Account is deactivated")
    user = CurrentUser(id=uuid.UUID(str(row["id"])), email=row.get("email"), username=row["username"],
                       display_name=row.get("display_name"), avatar_url=row.get("avatar_url"),
                       role=row.get("role") or "trader", is_active=True)
    request.state.user_id = user.sid
    return user


def _bearer(request: Request) -> str | None:
    header = request.headers.get("authorization")
    if not header:
        return None
    scheme, _, token = header.partition(" ")
    if scheme.lower() != "bearer" or not token.strip():
        raise Unauthorized("Missing or invalid Authorization header")
    return token.strip()


async def optional_user(request: Request, db: Database = Depends(get_db), cache: Cache = Depends(get_cache),
                        settings: Settings = Depends(get_settings_dep)) -> CurrentUser | None:
    """Public endpoint with optional identity. A *present but invalid* token is an error (so the
    client can refresh it), it is never silently downgraded to anonymous."""
    token = _bearer(request)
    if token is None:
        return None
    return await _resolve_user(request, token, db, cache, settings)


async def require_user(request: Request, db: Database = Depends(get_db), cache: Cache = Depends(get_cache),
                       settings: Settings = Depends(get_settings_dep)) -> CurrentUser:
    token = _bearer(request)
    if token is None:
        raise Unauthorized("Not authenticated")
    return await _resolve_user(request, token, db, cache, settings)


async def require_admin(user: CurrentUser = Depends(require_user)) -> CurrentUser:
    if not user.is_admin:
        raise Forbidden("Admin access required")
    return user
