from __future__ import annotations

import logging
import uuid
from typing import Any

from fastapi import APIRouter, Depends, Query, Request

from ..db import Database
from ..deps import get_db, get_realtime
from ..errors import BadRequest, Forbidden, NotFound
from ..ratelimit import rate_limit
from ..realtime import RealtimePublisher, session_topic
from ..schemas import SessionCreate
from ..security import CurrentUser, optional_user, require_admin, require_user

log = logging.getLogger("fxzone.sessions")
router = APIRouter(prefix="/api/sessions", tags=["sessions"])

ACTIVE = "role NOT IN ('pending', 'rejected') AND left_at IS NULL"

_SESSION_SELECT = """SELECT s.id, s.host_id, s.title, s.description, s.session_type::text AS session_type,
       s.status::text AS status, s.max_participants, s.requires_approval, s.viewer_count, s.started_at, s.ended_at,
       s.created_at, u.username, u.display_name, u.avatar_url
FROM live_sessions s JOIN users u ON u.id = s.host_id"""


def _session(r: dict[str, Any]) -> dict[str, Any]:
    dn = r["display_name"] or r["username"]
    hid = str(r["host_id"])
    return {"id": str(r["id"]), "host_id": hid, "hostId": hid,
            "host": {"id": hid, "username": r["username"], "display_name": dn, "displayName": dn,
                     "avatar_url": r["avatar_url"], "avatarUrl": r["avatar_url"]},
            "title": r["title"], "description": r["description"] or "", "status": r["status"],
            "session_type": r["session_type"], "max_participants": r["max_participants"],
            "requires_approval": r["requires_approval"], "requiresApproval": r["requires_approval"],
            "viewer_count": r["viewer_count"], "participants_count": r["viewer_count"], "participantsCount": r["viewer_count"],
            "started_at": r["started_at"], "startedAt": r["started_at"], "ended_at": r["ended_at"], "created_at": r["created_at"]}


def _uuid(v: str) -> uuid.UUID:
    try:
        return uuid.UUID(v)
    except ValueError:
        raise NotFound("Session not found") from None


async def _recount(conn, sid: uuid.UUID) -> int:
    return await conn.fetchval(
        f"""UPDATE live_sessions SET viewer_count = (SELECT count(*) FROM session_participants WHERE session_id = $1 AND {ACTIVE})
            WHERE id = $1 RETURNING viewer_count""", sid)


def _broadcast_count(realtime: RealtimePublisher, sid: uuid.UUID, count: int) -> None:
    realtime.publish_nowait(session_topic(sid), "members_update", {"data": {"count": count}})


@router.get("")
async def list_sessions(limit: int = Query(50, ge=1, le=100), user: CurrentUser | None = Depends(optional_user),
                        db: Database = Depends(get_db)):
    rows = await db.fetch(
        _SESSION_SELECT + """ WHERE s.status <> 'ended' AND (s.session_type = 'public' OR s.host_id = $1::uuid
              OR EXISTS (SELECT 1 FROM session_participants sp WHERE sp.session_id = s.id AND sp.user_id = $1::uuid))
           ORDER BY s.created_at DESC LIMIT $2""", user.id if user else None, limit)
    return [_session(r) for r in rows]


@router.post("", status_code=201, dependencies=[Depends(rate_limit("session_create", 10))])
async def create_session(body: SessionCreate, request: Request, user: CurrentUser = Depends(require_user),
                         db: Database = Depends(get_db)):
    # Private / invite-only rooms always need host approval; otherwise honour the UI toggle (default: open).
    approval = True if body.session_type != "public" else bool(body.requires_approval)
    async with db.transaction() as conn:
        sid = await conn.fetchval(
            """INSERT INTO live_sessions (host_id, title, description, session_type, status, max_participants, requires_approval,
                                          viewer_count, started_at)
               VALUES ($1,$2,$3,$4::session_type_enum,'live',$5,$6,1,NOW()) RETURNING id""",
            user.id, body.title, body.description, body.session_type, body.max_participants or 100, approval)
        await conn.execute("INSERT INTO session_participants (session_id, user_id, role) VALUES ($1,$2,'host')", sid, user.id)
    if body.session_type == "public":
        await request.app.state.notifier.notify_followers(
            user.id, "session_live", f"{user.display_name or user.username} is live", body.title,
            {"session_id": str(sid), "actor_id": user.sid, "actor_username": user.username})
    return _session(await db.fetchrow(_SESSION_SELECT + " WHERE s.id = $1", sid))


@router.delete("/history")
async def clear_history(_: CurrentUser = Depends(require_admin), db: Database = Depends(get_db)):
    await db.execute("DELETE FROM live_sessions WHERE status = 'ended'")
    return {"success": True}


@router.delete("")
async def clear_history_alias(_: CurrentUser = Depends(require_admin), db: Database = Depends(get_db)):
    await db.execute("DELETE FROM live_sessions WHERE status = 'ended'")
    return {"success": True, "message": "Ended sessions cleared"}


@router.get("/{session_id}")
async def get_session(session_id: str, db: Database = Depends(get_db)):
    row = await db.fetchrow(_SESSION_SELECT + " WHERE s.id = $1", _uuid(session_id))
    if not row:
        raise NotFound("Session not found")
    return _session(row)


async def _end(db: Database, realtime: RealtimePublisher, sid: uuid.UUID) -> None:
    async with db.transaction() as conn:
        await conn.execute("UPDATE live_sessions SET status = 'ended', ended_at = COALESCE(ended_at, NOW()), viewer_count = 0 WHERE id = $1", sid)
        await conn.execute("UPDATE session_participants SET left_at = NOW() WHERE session_id = $1 AND left_at IS NULL", sid)
    realtime.publish_nowait(session_topic(sid), "session_ended", {})


@router.post("/{session_id}/end")
async def end_session(session_id: str, user: CurrentUser = Depends(require_user), db: Database = Depends(get_db),
                      realtime: RealtimePublisher = Depends(get_realtime)):
    sid = _uuid(session_id)
    host = await db.fetchval("SELECT host_id FROM live_sessions WHERE id = $1", sid)
    if host is None:
        raise NotFound("Session not found")
    if host != user.id and not user.is_admin:
        raise Forbidden("Only the host or an admin can end this session")
    await _end(db, realtime, sid)
    return {"success": True}


@router.delete("/{session_id}")
async def delete_session(session_id: str, user: CurrentUser = Depends(require_user), db: Database = Depends(get_db),
                         realtime: RealtimePublisher = Depends(get_realtime)):
    sid = _uuid(session_id)
    s = await db.fetchrow("SELECT host_id, status::text AS status FROM live_sessions WHERE id = $1", sid)
    if s is None:
        return {"success": True}  # idempotent
    if s["host_id"] != user.id and not user.is_admin:
        raise Forbidden("Only the host or an admin can delete this session")
    if s["status"] != "ended":
        realtime.publish_nowait(session_topic(sid), "session_ended", {})
    await db.execute("DELETE FROM live_sessions WHERE id = $1", sid)
    return {"success": True}


def _participant(r: dict[str, Any]) -> dict[str, Any]:
    return {"id": str(r["id"]), "session_id": str(r["session_id"]), "user_id": str(r["user_id"]), "role": r["role"],
            "joined_at": r["joined_at"], "left_at": r["left_at"]}


@router.post("/{session_id}/join", dependencies=[Depends(rate_limit("session_join", 120))])
async def join_session(session_id: str, user: CurrentUser = Depends(require_user), db: Database = Depends(get_db),
                       realtime: RealtimePublisher = Depends(get_realtime)):
    """Idempotent: the UI polls this endpoint while a request is pending approval."""
    sid = _uuid(session_id)
    changed = False
    async with db.transaction() as conn:
        s = await conn.fetchrow(
            "SELECT host_id, status::text AS status, max_participants, requires_approval, session_type::text AS session_type "
            "FROM live_sessions WHERE id = $1 FOR UPDATE", sid)
        if not s:
            raise NotFound("Session not found")
        if s["status"] == "ended":
            raise BadRequest("Session has already ended")
        ex = await conn.fetchrow("SELECT id, role::text AS role, left_at FROM session_participants WHERE session_id = $1 AND user_id = $2", sid, user.id)
        if ex and ex["role"] == "rejected":
            raise Forbidden("The host declined your request to join this session")

        if s["host_id"] == user.id:
            role = "host"
        elif ex and ex["role"] in ("viewer", "co_host"):
            role = ex["role"]  # previously approved: keep
        elif ex and ex["role"] == "pending":
            role = "pending"
        else:
            role = "pending" if (s["requires_approval"] or s["session_type"] != "public") else "viewer"

        unchanged = ex and ex["role"] == role and ex["left_at"] is None
        if not unchanged:
            if role in ("viewer", "co_host") and s["max_participants"]:
                active = await conn.fetchval(f"SELECT count(*) FROM session_participants WHERE session_id = $1 AND {ACTIVE}", sid)
                if active >= s["max_participants"]:
                    raise BadRequest("Session has reached maximum participant capacity")
            await conn.execute(
                """INSERT INTO session_participants (session_id, user_id, role, joined_at, left_at) VALUES ($1,$2,$3::participant_role,NOW(),NULL)
                   ON CONFLICT (session_id, user_id) DO UPDATE SET role = EXCLUDED.role, joined_at = NOW(), left_at = NULL""",
                sid, user.id, role)
            count = await _recount(conn, sid)
            changed = True
        part = await conn.fetchrow("SELECT id, session_id, user_id, role::text AS role, joined_at, left_at FROM session_participants WHERE session_id = $1 AND user_id = $2", sid, user.id)
    if changed:
        _broadcast_count(realtime, sid, count)
    return _participant(part)


@router.post("/{session_id}/leave")
async def leave_session(session_id: str, user: CurrentUser = Depends(require_user), db: Database = Depends(get_db),
                        realtime: RealtimePublisher = Depends(get_realtime)):
    sid = _uuid(session_id)
    host = await db.fetchval("SELECT host_id FROM live_sessions WHERE id = $1", sid)
    if host is None:
        return {"success": True}
    if host == user.id:
        await _end(db, realtime, sid)  # the host leaving ends the broadcast
        return {"success": True}
    async with db.transaction() as conn:
        await conn.execute("UPDATE session_participants SET left_at = NOW() WHERE session_id = $1 AND user_id = $2 AND left_at IS NULL", sid, user.id)
        count = await _recount(conn, sid)
    _broadcast_count(realtime, sid, count)
    return {"success": True}


async def _can_manage(db: Database, sid: uuid.UUID, user: CurrentUser) -> bool:
    row = await db.fetchrow(
        """SELECT s.host_id, (SELECT role::text FROM session_participants WHERE session_id = s.id AND user_id = $2) AS my_role
           FROM live_sessions s WHERE s.id = $1""", sid, user.id)
    if row is None:
        raise NotFound("Session not found")
    return user.is_admin or row["host_id"] == user.id or row["my_role"] == "co_host"


@router.get("/{session_id}/participants")
async def participants(session_id: str, user: CurrentUser = Depends(require_user), db: Database = Depends(get_db)):
    sid = _uuid(session_id)
    manager = await _can_manage(db, sid, user)
    if not manager and not await db.fetchval(
            f"SELECT 1 FROM session_participants WHERE session_id = $1 AND user_id = $2 AND role NOT IN ('rejected')", sid, user.id):
        raise Forbidden("Join the session to see its participants")
    rows = await db.fetch(
        """SELECT sp.id, sp.session_id, sp.user_id, sp.role::text AS role, sp.joined_at, sp.left_at,
                  u.username, u.display_name, u.avatar_url
           FROM session_participants sp JOIN users u ON u.id = sp.user_id
           WHERE sp.session_id = $1 AND sp.left_at IS NULL AND sp.role <> 'rejected' AND ($2 OR sp.role <> 'pending')
           ORDER BY sp.joined_at""", sid, manager)
    out = []
    for r in rows:
        dn = r["display_name"] or r["username"]
        out.append({**_participant(r), "user": {"id": str(r["user_id"]), "username": r["username"], "displayName": dn,
                                                "display_name": dn, "avatarUrl": r["avatar_url"], "avatar_url": r["avatar_url"]}})
    return out


@router.post("/{session_id}/approve/{target_id}")
async def approve(session_id: str, target_id: str, user: CurrentUser = Depends(require_user), db: Database = Depends(get_db),
                  realtime: RealtimePublisher = Depends(get_realtime)):
    sid, tid = _uuid(session_id), _uuid(target_id)
    if not await _can_manage(db, sid, user):
        raise Forbidden("Only the host can approve participants")
    async with db.transaction() as conn:
        s = await conn.fetchrow("SELECT status::text AS status, max_participants FROM live_sessions WHERE id = $1 FOR UPDATE", sid)
        if s["status"] == "ended":
            raise BadRequest("Session has already ended")
        p = await conn.fetchrow("SELECT role::text AS role FROM session_participants WHERE session_id = $1 AND user_id = $2 AND left_at IS NULL", sid, tid)
        if not p:
            raise NotFound("No pending request from that user")
        if p["role"] == "pending":
            active = await conn.fetchval(f"SELECT count(*) FROM session_participants WHERE session_id = $1 AND {ACTIVE}", sid)
            if s["max_participants"] and active >= s["max_participants"]:
                raise BadRequest("Session has reached maximum participant capacity")
            await conn.execute("UPDATE session_participants SET role = 'viewer' WHERE session_id = $1 AND user_id = $2", sid, tid)
        count = await _recount(conn, sid)
    realtime.publish_nowait(session_topic(sid), "participant_approved", {"user_id": str(tid)})
    _broadcast_count(realtime, sid, count)
    return {"success": True}


@router.post("/{session_id}/reject/{target_id}")
async def reject(session_id: str, target_id: str, user: CurrentUser = Depends(require_user), db: Database = Depends(get_db),
                 realtime: RealtimePublisher = Depends(get_realtime)):
    sid, tid = _uuid(session_id), _uuid(target_id)
    if not await _can_manage(db, sid, user):
        raise Forbidden("Only the host can reject participants")
    host = await db.fetchval("SELECT host_id FROM live_sessions WHERE id = $1", sid)
    if tid == host:
        raise BadRequest("The host cannot be removed")
    async with db.transaction() as conn:
        res = await conn.execute(
            "UPDATE session_participants SET role = 'rejected', left_at = NOW() WHERE session_id = $1 AND user_id = $2", sid, tid)
        if res.endswith(" 0"):
            raise NotFound("Participant not found")
        count = await _recount(conn, sid)
    realtime.publish_nowait(session_topic(sid), "participant_rejected", {"user_id": str(tid)})
    _broadcast_count(realtime, sid, count)
    return {"success": True}
