from __future__ import annotations

import logging

import asyncpg
from fastapi import APIRouter, Depends, Request

from ..cache import Cache
from ..db import Database
from ..deps import get_cache, get_db
from ..errors import Conflict, UpstreamUnavailable
from ..ratelimit import rate_limit
from ..schemas import ProfileUpdate
from ..security import CurrentUser, require_user
from ..services.supabase_admin import SupabaseAdmin

log = logging.getLogger("fxzone.auth")
router = APIRouter(prefix="/api/auth", tags=["auth"])

_ME = """SELECT id, email, username, display_name, avatar_url, bio, COALESCE(preferred_broker, 'Exness') AS preferred_broker,
                role::text AS role, is_active, followers_count, following_count, created_at, updated_at FROM users WHERE id = $1"""


def _me(r: dict) -> dict:
    return {**r, "id": str(r["id"])}


@router.get("/me")
async def get_me(user: CurrentUser = Depends(require_user), db: Database = Depends(get_db)):
    row = await db.fetchrow(_ME, user.id)
    return _me(row)  # own email is fine to return to its owner


@router.put("/me", dependencies=[Depends(rate_limit("profile_update", 20))])
async def update_me(body: ProfileUpdate, request: Request, user: CurrentUser = Depends(require_user),
                    db: Database = Depends(get_db), cache: Cache = Depends(get_cache)):
    provided = {k: getattr(body, k) for k in body.model_fields_set if k in ("username", "display_name", "bio", "avatar_url", "preferred_broker")}
    if "avatar_url" in provided and provided["avatar_url"] == "":
        provided["avatar_url"] = None
    if provided:
        sets = ", ".join(f"{col} = ${i}" for i, col in enumerate(provided, start=2))
        try:
            await db.execute(f"UPDATE users SET {sets}, updated_at = NOW() WHERE id = $1", user.id, *provided.values())
        except asyncpg.UniqueViolationError:
            raise Conflict("That username is already taken") from None
        await cache.delete(f"profile:{user.sid}")
        admin: SupabaseAdmin = request.app.state.supabase_admin
        await admin.update_metadata(user.sid, {k: v for k, v in provided.items()})
    return _me(await db.fetchrow(_ME, user.id))


@router.delete("/me", dependencies=[Depends(rate_limit("account_delete", 5, 3600))])
async def delete_me(request: Request, user: CurrentUser = Depends(require_user), db: Database = Depends(get_db),
                    cache: Cache = Depends(get_cache)):
    """Deleting the Supabase identity cascades (FK ON DELETE CASCADE) through every user-owned table.
    The identity is deleted FIRST so a half-deleted account can never log back in."""
    admin: SupabaseAdmin = request.app.state.supabase_admin
    settings = request.app.state.settings
    if admin.enabled:
        if not await admin.delete_user(user.sid):
            raise UpstreamUnavailable("Could not delete your account right now. Nothing was changed; please retry.")
    elif settings.is_production:
        raise UpstreamUnavailable("Account deletion is not configured")
    await db.execute("DELETE FROM users WHERE id = $1", user.id)  # idempotent; covers dev without service key
    await cache.delete(f"profile:{user.sid}")
    return {"success": True, "message": "Account permanently deleted"}
