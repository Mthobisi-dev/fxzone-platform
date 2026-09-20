from __future__ import annotations

import logging
import uuid
from datetime import datetime
from typing import Any

from fastapi import APIRouter, Depends, Query, Request

from ..db import Database
from ..deps import get_db, get_realtime
from ..errors import BadRequest, Forbidden, NotFound
from ..ratelimit import rate_limit
from ..realtime import RealtimePublisher, chat_topic
from ..schemas import ConversationCreate, ConversationUpdate, MembersAdd, MessageCreate
from ..security import CurrentUser, require_user
from ..services.posts import avatar
from fastapi.encoders import jsonable_encoder

log = logging.getLogger("fxzone.chat")
router = APIRouter(prefix="/api/chat", tags=["chat"])
MAX_GROUP_MEMBERS = 50

_CONV_SELECT = """
SELECT c.id, c.name, c.description, c.is_group, c.creator_id, c.created_at, c.updated_at, me.last_read_at,
  (SELECT count(*) FROM messages m WHERE m.conversation_id = c.id AND m.sender_id <> $1
      AND m.created_at > COALESCE(me.last_read_at, 'epoch'::timestamptz))::int AS unread_count,
  (SELECT json_build_object('content', m.content, 'created_at', m.created_at, 'sender_id', m.sender_id,
                            'message_type', m.message_type)
     FROM messages m WHERE m.conversation_id = c.id ORDER BY m.created_at DESC LIMIT 1) AS last_message,
  (SELECT COALESCE(json_agg(json_build_object('id', u.id, 'username', u.username, 'display_name', u.display_name,
                                              'avatar_url', u.avatar_url) ORDER BY cm.joined_at), '[]'::json)
     FROM conversation_members cm JOIN users u ON u.id = cm.user_id WHERE cm.conversation_id = c.id) AS members
FROM conversation_members me JOIN conversations c ON c.id = me.conversation_id
"""


def _conv(r: dict[str, Any]) -> dict[str, Any]:
    last = r["last_message"]
    return {"id": str(r["id"]), "name": r["name"], "description": r["description"], "is_group": r["is_group"],
            "creator_id": str(r["creator_id"]) if r["creator_id"] else None,
            "created_at": r["created_at"], "updated_at": r["updated_at"], "last_read_at": r["last_read_at"],
            "members": r["members"], "unread_count": r["unread_count"], "unreadCount": r["unread_count"],
            "last_message": last, "lastMessage": ({"content": last["content"], "createdAt": last["created_at"]} if last else None)}


async def _get_conv(db: Database, viewer: uuid.UUID, conv_id: uuid.UUID) -> dict[str, Any] | None:
    row = await db.fetchrow(_CONV_SELECT + " WHERE me.user_id = $1 AND c.id = $2", viewer, conv_id)
    return _conv(row) if row else None


def _uuid(v: str) -> uuid.UUID:
    try:
        return uuid.UUID(v)
    except ValueError:
        raise NotFound("Conversation not found") from None


async def _require_member(db: Database, conv_id: uuid.UUID, user: CurrentUser) -> None:
    if not await db.fetchval("SELECT 1 FROM conversation_members WHERE conversation_id = $1 AND user_id = $2", conv_id, user.id):
        raise Forbidden("Not a member of this conversation")


async def _resolve_users(db: Database, ids: list[uuid.UUID], usernames: list[str]) -> list[uuid.UUID]:
    found: dict[uuid.UUID, None] = {}
    if ids:
        rows = await db.fetch("SELECT id FROM users WHERE id = ANY($1::uuid[]) AND is_active", list(set(ids)))
        got = {r["id"] for r in rows}
        missing = set(ids) - got
        if missing:
            raise NotFound("One or more users were not found")
        found.update(dict.fromkeys(ids))
    for name in dict.fromkeys(u.strip().lstrip("@") for u in usernames if u.strip()):
        row = await db.fetchrow("SELECT id FROM users WHERE lower(username) = lower($1) AND is_active", name)
        if not row:
            raise NotFound(f"User '{name}' not found")
        found[row["id"]] = None
    return list(found)


@router.get("/conversations")
async def list_conversations(limit: int = Query(100, ge=1, le=200), offset: int = Query(0, ge=0),
                             user: CurrentUser = Depends(require_user), db: Database = Depends(get_db)):
    rows = await db.fetch(_CONV_SELECT + " WHERE me.user_id = $1 ORDER BY c.updated_at DESC LIMIT $2 OFFSET $3",
                          user.id, limit, offset)
    return [_conv(r) for r in rows]


@router.post("/conversations", dependencies=[Depends(rate_limit("conv_create", 30))])
async def create_conversation(body: ConversationCreate, request: Request, user: CurrentUser = Depends(require_user),
                              db: Database = Depends(get_db)):
    from fastapi.responses import JSONResponse
    targets = [u for u in await _resolve_users(db, body.participant_ids, ([body.username] if body.username else []) + body.usernames)
               if u != user.id]
    if not targets:
        raise BadRequest("participant_ids required")
    if not body.is_group:
        if len(targets) != 1:
            raise BadRequest("Direct chats have exactly one other participant; use is_group for more")
        other = targets[0]
        async with db.transaction() as conn:
            a, b = sorted([str(user.id), str(other)])
            await conn.execute("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", f"dm:{a}:{b}")  # no duplicate DMs on races
            existing = await conn.fetchval(
                """SELECT c.id FROM conversations c WHERE NOT c.is_group
                     AND EXISTS (SELECT 1 FROM conversation_members m WHERE m.conversation_id = c.id AND m.user_id = $1)
                     AND EXISTS (SELECT 1 FROM conversation_members m WHERE m.conversation_id = c.id AND m.user_id = $2)
                   LIMIT 1""", user.id, other)
            if existing:
                return jsonable_encoder(await _get_conv(db, user.id, existing))
            conv_id = await conn.fetchval("INSERT INTO conversations (is_group, creator_id) VALUES (false, $1) RETURNING id", user.id)
            await conn.execute("INSERT INTO conversation_members (conversation_id, user_id) SELECT $1, unnest($2::uuid[])",
                               conv_id, [user.id, other])
        return JSONResponse(jsonable_encoder(await _get_conv(db, user.id, conv_id)), status_code=201)

    if not body.name:
        raise BadRequest("Group chats need a name")
    if len(targets) + 1 > MAX_GROUP_MEMBERS:
        raise BadRequest(f"Groups are limited to {MAX_GROUP_MEMBERS} members")
    async with db.transaction() as conn:
        conv_id = await conn.fetchval(
            "INSERT INTO conversations (name, description, is_group, creator_id) VALUES ($1,$2,true,$3) RETURNING id",
            body.name, body.description, user.id)
        await conn.execute("INSERT INTO conversation_members (conversation_id, user_id) SELECT $1, unnest($2::uuid[])",
                           conv_id, [user.id, *targets])
    return JSONResponse(jsonable_encoder(await _get_conv(db, user.id, conv_id)), status_code=201)


@router.get("/conversations/{conv_id}")
async def get_conversation(conv_id: str, user: CurrentUser = Depends(require_user), db: Database = Depends(get_db)):
    conv = await _get_conv(db, user.id, _uuid(conv_id))
    if not conv:
        raise NotFound("Conversation not found")
    return conv


@router.patch("/conversations/{conv_id}")
async def update_conversation(conv_id: str, body: ConversationUpdate, user: CurrentUser = Depends(require_user),
                              db: Database = Depends(get_db)):
    cid = _uuid(conv_id)
    row = await db.fetchrow("SELECT is_group, creator_id FROM conversations WHERE id = $1", cid)
    await _require_member(db, cid, user)
    if not row or not row["is_group"]:
        raise BadRequest("Only group chats can be edited")
    if row["creator_id"] != user.id and not user.is_admin:
        raise Forbidden("Only the group creator can edit group settings")
    fields = {k: getattr(body, k) for k in body.model_fields_set if k in ("name", "description")}
    if fields:
        sets = ", ".join(f"{c} = ${i}" for i, c in enumerate(fields, start=2))
        await db.execute(f"UPDATE conversations SET {sets}, updated_at = NOW() WHERE id = $1", cid, *fields.values())
    return await _get_conv(db, user.id, cid)


@router.post("/conversations/{conv_id}/members", dependencies=[Depends(rate_limit("conv_members", 30))])
async def add_members(conv_id: str, body: MembersAdd, user: CurrentUser = Depends(require_user), db: Database = Depends(get_db)):
    cid = _uuid(conv_id)
    await _require_member(db, cid, user)
    if not await db.fetchval("SELECT is_group FROM conversations WHERE id = $1", cid):
        raise BadRequest("Members can only be added to group chats")
    ids = await _resolve_users(db, body.user_ids, body.usernames)
    if not ids:
        raise BadRequest("No users supplied")
    async with db.transaction() as conn:
        await conn.execute("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", f"members:{cid}")
        current = await conn.fetchval("SELECT count(*) FROM conversation_members WHERE conversation_id = $1", cid)
        if current + len(ids) > MAX_GROUP_MEMBERS:
            raise BadRequest(f"Groups are limited to {MAX_GROUP_MEMBERS} members")
        await conn.execute("INSERT INTO conversation_members (conversation_id, user_id) SELECT $1, unnest($2::uuid[]) ON CONFLICT DO NOTHING",
                           cid, ids)
    return await _get_conv(db, user.id, cid)


@router.delete("/conversations/{conv_id}/members/{member_id}")
async def remove_member(conv_id: str, member_id: str, user: CurrentUser = Depends(require_user), db: Database = Depends(get_db)):
    """member_id may be 'me'. Anyone can leave; only the creator (or an admin) can remove others."""
    cid = _uuid(conv_id)
    await _require_member(db, cid, user)
    conv = await db.fetchrow("SELECT is_group, creator_id FROM conversations WHERE id = $1", cid)
    if not conv or not conv["is_group"]:
        raise BadRequest("Membership can only be changed in group chats")
    target = user.id if member_id == "me" else _uuid(member_id)
    if target != user.id and conv["creator_id"] != user.id and not user.is_admin:
        raise Forbidden("Only the group creator can remove other members")
    await db.execute("DELETE FROM conversation_members WHERE conversation_id = $1 AND user_id = $2", cid, target)
    if not await db.fetchval("SELECT 1 FROM conversation_members WHERE conversation_id = $1", cid):
        await db.execute("DELETE FROM conversations WHERE id = $1", cid)  # last one out turns off the lights
    return {"success": True}


@router.post("/conversations/{conv_id}/read")
async def mark_read(conv_id: str, user: CurrentUser = Depends(require_user), db: Database = Depends(get_db)):
    cid = _uuid(conv_id)
    await _require_member(db, cid, user)
    await db.execute("UPDATE conversation_members SET last_read_at = NOW() WHERE conversation_id = $1 AND user_id = $2", cid, user.id)
    return {"success": True}


def _message(r: dict[str, Any]) -> dict[str, Any]:
    return {"id": str(r["id"]), "conversation_id": str(r["conversation_id"]), "sender_id": str(r["sender_id"]),
            "sender": {"id": str(r["sender_id"]), "username": r["username"], "display_name": r["display_name"] or r["username"],
                       "avatar_url": avatar(r["avatar_url"], r["username"])},
            "content": r["content"], "message_type": r["message_type"] or "text", "created_at": r["created_at"]}


_MSG_SELECT = """SELECT m.id, m.conversation_id, m.sender_id, m.content, m.message_type, m.created_at,
       u.username, u.display_name, u.avatar_url FROM messages m JOIN users u ON u.id = m.sender_id"""


@router.get("/conversations/{conv_id}/messages")
async def list_messages(conv_id: str, limit: int = Query(50, ge=1, le=100), offset: int = Query(0, ge=0, le=100000),
                        before: datetime | None = None, user: CurrentUser = Depends(require_user),
                        db: Database = Depends(get_db)):
    cid = _uuid(conv_id)
    await _require_member(db, cid, user)
    if before:
        rows = await db.fetch(_MSG_SELECT + " WHERE m.conversation_id = $1 AND m.created_at < $2 ORDER BY m.created_at DESC, m.id DESC LIMIT $3",
                              cid, before, limit)
    else:
        rows = await db.fetch(_MSG_SELECT + " WHERE m.conversation_id = $1 ORDER BY m.created_at DESC, m.id DESC LIMIT $2 OFFSET $3",
                              cid, limit, offset)
    # Only write when there is something newer than our read marker (the UI polls this endpoint).
    await db.execute(
        """UPDATE conversation_members SET last_read_at = NOW() WHERE conversation_id = $1 AND user_id = $2
           AND last_read_at < (SELECT COALESCE(max(created_at), 'epoch') FROM messages WHERE conversation_id = $1)""", cid, user.id)
    return [_message(r) for r in reversed(rows)]  # oldest -> newest, as the UI expects


@router.post("/conversations/{conv_id}/messages", status_code=201, dependencies=[Depends(rate_limit("message", 60))])
async def send_message(conv_id: str, body: MessageCreate, user: CurrentUser = Depends(require_user),
                       db: Database = Depends(get_db), realtime: RealtimePublisher = Depends(get_realtime)):
    cid = _uuid(conv_id)
    await _require_member(db, cid, user)
    async with db.transaction() as conn:
        mid = await conn.fetchval("INSERT INTO messages (conversation_id, sender_id, content, message_type) VALUES ($1,$2,$3,$4) RETURNING id",
                                  cid, user.id, body.content, body.message_type)
        await conn.execute("UPDATE conversations SET updated_at = NOW() WHERE id = $1", cid)
        await conn.execute("UPDATE conversation_members SET last_read_at = NOW() WHERE conversation_id = $1 AND user_id = $2", cid, user.id)
    msg = _message(await db.fetchrow(_MSG_SELECT + " WHERE m.id = $1", mid))
    realtime.publish_nowait(chat_topic(cid), "new_message", jsonable_encoder(msg))
    return msg
