from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, Query

from ..db import Database
from ..deps import get_db
from ..schemas import NotificationsMark
from ..security import CurrentUser, require_user
from ..services.notifications import notification_to_api

router = APIRouter(prefix="/api/notifications", tags=["notifications"])
_COLS = "id, user_id, type, title, message, data, is_read, created_at"


@router.get("")
async def list_notifications(limit: int = Query(50, ge=1, le=100), unread_only: bool = False,
                             user: CurrentUser = Depends(require_user), db: Database = Depends(get_db)):
    rows = await db.fetch(f"SELECT {_COLS} FROM notifications WHERE user_id = $1 AND (NOT $3 OR NOT is_read) "
                          "ORDER BY created_at DESC LIMIT $2", user.id, limit, unread_only)
    return [notification_to_api(r) for r in rows]


@router.get("/unread-count")
async def unread_count(user: CurrentUser = Depends(require_user), db: Database = Depends(get_db)):
    return {"count": await db.fetchval("SELECT count(*) FROM notifications WHERE user_id = $1 AND NOT is_read", user.id)}


@router.put("")
async def mark_some(body: NotificationsMark | None = None, user: CurrentUser = Depends(require_user), db: Database = Depends(get_db)):
    ids = body.ids if body else None
    if ids:
        await db.execute("UPDATE notifications SET is_read = true WHERE user_id = $1 AND id = ANY($2::uuid[])", user.id, ids)
    else:
        await db.execute("UPDATE notifications SET is_read = true WHERE user_id = $1 AND NOT is_read", user.id)
    return {"success": True}


@router.put("/read-all")
async def mark_all(user: CurrentUser = Depends(require_user), db: Database = Depends(get_db)):
    await db.execute("UPDATE notifications SET is_read = true WHERE user_id = $1 AND NOT is_read", user.id)
    return {"success": True}


@router.put("/{notification_id}/read")
async def mark_one(notification_id: str, user: CurrentUser = Depends(require_user), db: Database = Depends(get_db)):
    try:
        nid = uuid.UUID(notification_id)
    except ValueError:
        return {"success": True}
    await db.execute("UPDATE notifications SET is_read = true WHERE id = $1 AND user_id = $2", nid, user.id)  # scoped to owner
    return {"success": True}
