from __future__ import annotations

import logging
import uuid
from typing import Any

import asyncpg
from fastapi import APIRouter, Depends, File, Query, Request, UploadFile

from ..config import Settings
from ..db import Database, esc_like
from ..deps import get_db, get_settings_dep
from ..errors import BadRequest, Forbidden, NotFound
from ..ratelimit import rate_limit
from ..schemas import CommentCreate, PostCreate, ReactBody, StoryCreate, UserActionBody
from ..security import CurrentUser, optional_user, require_user
from ..services.notifications import Notifier
from ..services.posts import (POST_SELECT, avatar, fetch_post, is_uuid, list_posts, post_to_api, resolve_tags,
                              user_public)
from ..services.storage import StorageService, detect_media, read_limited

log = logging.getLogger("fxzone.social")
router = APIRouter(prefix="/api/social", tags=["social"])

MAX_PINNED = 3
STORY_TTL_HOURS = 24
VIEWER = lambda u: u.id if u else None  # noqa: E731


def _uuid(value: str, what: str = "resource") -> uuid.UUID:
    try:
        return uuid.UUID(value)
    except ValueError:
        raise NotFound(f"{what.capitalize()} not found") from None


def _notifier(request: Request) -> Notifier:
    return request.app.state.notifier


def _snippet(text: str, n: int = 80) -> str:
    return text if len(text) <= n else text[: n - 1] + "…"


# ───────────────────────────── feed & posts ─────────────────────────────
@router.get("/feed", dependencies=[Depends(rate_limit("feed_read", 240))])
async def feed(limit: int = Query(20, ge=1, le=50), offset: int = Query(0, ge=0, le=10000),
               user: CurrentUser | None = Depends(optional_user), db: Database = Depends(get_db)):
    return await list_posts(db, VIEWER(user), "p.is_story = false", [], "p.created_at DESC, p.id DESC", limit, offset)


@router.get("/posts")
async def list_posts_route(limit: int = Query(20, ge=1, le=50), offset: int = Query(0, ge=0, le=10000),
                           user_id: uuid.UUID | None = None, user: CurrentUser | None = Depends(optional_user),
                           db: Database = Depends(get_db)):
    if user_id:
        return await list_posts(db, VIEWER(user), "p.is_story = false AND p.user_id = $2", [user_id],
                                "p.is_pinned DESC, p.created_at DESC, p.id DESC", limit, offset)
    return await list_posts(db, VIEWER(user), "p.is_story = false", [], "p.created_at DESC, p.id DESC", limit, offset)


async def _create_post(body: PostCreate, user: CurrentUser, db: Database, story: bool) -> dict[str, Any]:
    content = body.content or "📊 Shared media attachment"
    tag_ids = await resolve_tags(db, body.asset_tags, content)
    async with db.transaction() as conn:
        post_id = await conn.fetchval(
            """INSERT INTO posts (user_id, content, image_url, caption, is_story, expires_at,
                                  show_comments_count, show_likes_count, allow_reshare, allow_save, allow_share)
               VALUES ($1,$2,$3,$4,$5, CASE WHEN $5 THEN NOW() + make_interval(hours => $6) END, $7,$8,$9,$10,$11)
               RETURNING id""",
            user.id, content, body.image_url, body.caption or None, story, STORY_TTL_HOURS,
            body.show_comments_count, body.show_likes_count, body.allow_reshare, body.allow_save, body.allow_share)
        if tag_ids:
            await conn.execute("INSERT INTO post_asset_tags (post_id, asset_id) SELECT $1, unnest($2::uuid[]) ON CONFLICT DO NOTHING",
                               post_id, tag_ids)
    return await fetch_post(db, user.id, post_id)  # type: ignore[return-value]


@router.post("/posts", status_code=201, dependencies=[Depends(rate_limit("post_create", 20))])
async def create_post(body: PostCreate, user: CurrentUser = Depends(require_user), db: Database = Depends(get_db)):
    return await _create_post(body, user, db, story=body.is_story)


@router.get("/posts/saved")
async def saved_posts(limit: int = Query(50, ge=1, le=100), offset: int = Query(0, ge=0),
                      user: CurrentUser = Depends(require_user), db: Database = Depends(get_db)):
    rows = await db.fetch(POST_SELECT + " JOIN bookmarks bk ON bk.post_id = p.id AND bk.user_id = $1::uuid "
                          "ORDER BY bk.created_at DESC LIMIT $2 OFFSET $3", user.id, limit, offset)
    return [post_to_api(r) for r in rows]


@router.delete("/posts/purge-all", dependencies=[Depends(rate_limit("purge", 5, 3600))])
async def purge_my_posts(user: CurrentUser = Depends(require_user), db: Database = Depends(get_db)):
    """Deletes the CALLER's own posts and stories (children cascade). It never touches other users' content."""
    n = await db.fetchval("WITH d AS (DELETE FROM posts WHERE user_id = $1 RETURNING 1) SELECT count(*) FROM d", user.id)
    return {"message": "Feed posts purged successfully", "deleted": n}


@router.post("/posts/upload", dependencies=[Depends(rate_limit("upload", 10))])
async def upload_media(request: Request, file: UploadFile = File(...), user: CurrentUser = Depends(require_user),
                       settings: Settings = Depends(get_settings_dep)):
    data = await read_limited(file, settings.max_upload_bytes)
    detected = detect_media(data[:32], file.content_type)
    if not detected:
        raise BadRequest("Unsupported file type. Allowed: PNG, JPEG, GIF, WebP, MP4/MOV, WebM, MP3/WAV/OGG/M4A audio, PDF")
    mime, ext = detected
    storage: StorageService = request.app.state.storage
    url = await storage.save(user.sid, data, mime, ext)
    return {"url": url, "content_type": mime, "size": len(data)}


@router.get("/posts/{post_id}")
async def get_post(post_id: str, user: CurrentUser | None = Depends(optional_user), db: Database = Depends(get_db)):
    post = await fetch_post(db, VIEWER(user), _uuid(post_id, "post"))
    if not post:
        raise NotFound("Post not found")
    return post


@router.delete("/posts/{post_id}")
async def delete_post(post_id: str, user: CurrentUser = Depends(require_user), db: Database = Depends(get_db)):
    if not is_uuid(post_id):  # optimistic client-side temp ids: nothing to delete server-side
        return {"message": "Post removed", "id": post_id}
    pid = uuid.UUID(post_id)
    owner = await db.fetchval("SELECT user_id FROM posts WHERE id = $1", pid)
    if owner is None:
        return {"message": "Post already deleted", "id": post_id}  # idempotent
    if owner != user.id and not user.is_admin:
        raise Forbidden("Only the post author or an admin can delete this post")
    await db.execute("DELETE FROM posts WHERE id = $1", pid)  # comments/reactions/bookmarks/tags cascade
    return {"message": "Post deleted successfully", "id": post_id}


# ───────────────────────────── engagement ─────────────────────────────
@router.post("/posts/{post_id}/react", dependencies=[Depends(rate_limit("react", 120))])
async def react(post_id: str, request: Request, body: ReactBody | None = None,
                user: CurrentUser = Depends(require_user), db: Database = Depends(get_db)):
    body = body or ReactBody()
    pid = _uuid(post_id, "post")
    post = await db.fetchrow("SELECT id, user_id, content FROM posts WHERE id = $1", pid)
    if not post:
        raise NotFound("Post not found")
    # Atomic toggle: delete-returning first; only if nothing was deleted do we insert.
    removed = await db.fetchval("DELETE FROM reactions WHERE post_id=$1 AND user_id=$2 AND reaction_type=$3 RETURNING 1",
                                pid, user.id, body.reaction_type)
    active = removed is None
    if active:
        await db.execute("INSERT INTO reactions (post_id, user_id, reaction_type) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING",
                         pid, user.id, body.reaction_type)
        await _notifier(request).notify(
            post["user_id"], "like", f"{user.display_name or user.username} liked your post", _snippet(post["content"]),
            {"post_id": str(pid), "actor_id": user.sid, "actor_username": user.username}, actor_id=user.id, dedupe_hours=1)
    likes = await db.fetchval("SELECT likes_count FROM posts WHERE id = $1", pid)
    return {"active": active, "likes_count": likes or 0, "reaction_type": body.reaction_type}


@router.post("/posts/{post_id}/repost", dependencies=[Depends(rate_limit("repost", 60))])
async def repost(post_id: str, user: CurrentUser = Depends(require_user), db: Database = Depends(get_db)):
    pid = _uuid(post_id, "post")
    post = await db.fetchrow("SELECT user_id, is_story, allow_reshare FROM posts WHERE id = $1", pid)
    if not post:
        raise NotFound("Post not found")
    if post["is_story"]:
        raise BadRequest("Stories cannot be reposted")
    removed = await db.fetchval("DELETE FROM reposts WHERE post_id=$1 AND user_id=$2 RETURNING 1", pid, user.id)
    is_reposted = removed is None
    if is_reposted:
        if not post["allow_reshare"] and post["user_id"] != user.id:
            raise Forbidden("The author has disabled resharing for this post")
        await db.execute("INSERT INTO reposts (post_id, user_id) VALUES ($1,$2) ON CONFLICT DO NOTHING", pid, user.id)
    count = await db.fetchval("SELECT reposts_count FROM posts WHERE id = $1", pid)
    return {"reposts_count": count or 0, "is_reposted": is_reposted}


@router.post("/posts/{post_id}/bookmark", dependencies=[Depends(rate_limit("bookmark", 120))])
async def bookmark(post_id: str, user: CurrentUser = Depends(require_user), db: Database = Depends(get_db)):
    pid = _uuid(post_id, "post")
    post = await db.fetchrow("SELECT user_id, allow_save FROM posts WHERE id = $1", pid)
    if not post:
        raise NotFound("Post not found")
    removed = await db.fetchval("DELETE FROM bookmarks WHERE post_id=$1 AND user_id=$2 RETURNING 1", pid, user.id)
    saved = removed is None
    if saved:
        if not post["allow_save"] and post["user_id"] != user.id:
            raise Forbidden("The author has disabled saving for this post")
        await db.execute("INSERT INTO bookmarks (post_id, user_id) VALUES ($1,$2) ON CONFLICT DO NOTHING", pid, user.id)
    return {"is_bookmarked": saved}


@router.post("/posts/{post_id}/pin", dependencies=[Depends(rate_limit("pin", 30))])
async def pin(post_id: str, user: CurrentUser = Depends(require_user), db: Database = Depends(get_db)):
    pid = _uuid(post_id, "post")
    post = await db.fetchrow("SELECT user_id, is_pinned, is_story FROM posts WHERE id = $1", pid)
    if not post:
        raise NotFound("Post not found")
    if post["user_id"] != user.id and not user.is_admin:
        raise Forbidden("Only the post author can pin this post")
    if post["is_story"]:
        raise BadRequest("Stories cannot be pinned")
    new = not post["is_pinned"]
    if new:
        pinned = await db.fetchval("SELECT count(*) FROM posts WHERE user_id = $1 AND is_pinned", post["user_id"])
        if pinned >= MAX_PINNED:
            raise BadRequest(f"You can pin at most {MAX_PINNED} posts")
    await db.execute("UPDATE posts SET is_pinned = $2 WHERE id = $1", pid, new)
    return {"id": post_id, "is_pinned": new, "message": "Post pinned" if new else "Post unpinned"}


# ───────────────────────────── comments ─────────────────────────────
def _comment(r: dict) -> dict:
    uid = str(r["user_id"])
    return {"id": str(r["id"]), "post_id": str(r["post_id"]), "user_id": uid,
            "user": {"id": uid, "username": r["username"], "display_name": r["display_name"] or r["username"],
                     "avatar_url": avatar(r["avatar_url"], r["username"]), "role": r["role"]},
            "content": r["content"], "parent_id": str(r["parent_id"]) if r["parent_id"] else None,
            "created_at": r["created_at"]}


_COMMENT_SELECT = """SELECT c.id, c.post_id, c.user_id, c.content, c.parent_id, c.created_at,
       u.username, u.display_name, u.avatar_url, u.role::text AS role
FROM comments c JOIN users u ON u.id = c.user_id"""


@router.get("/posts/{post_id}/comments")
async def list_comments(post_id: str, limit: int = Query(200, ge=1, le=500), offset: int = Query(0, ge=0),
                        db: Database = Depends(get_db)):
    pid = _uuid(post_id, "post")
    rows = await db.fetch(_COMMENT_SELECT + " WHERE c.post_id = $1 ORDER BY c.created_at ASC, c.id ASC LIMIT $2 OFFSET $3",
                          pid, limit, offset)
    return [_comment(r) for r in rows]  # flat list incl. replies (parent_id links the thread)


@router.post("/posts/{post_id}/comments", status_code=201, dependencies=[Depends(rate_limit("comment", 30))])
async def add_comment(post_id: str, body: CommentCreate, request: Request, user: CurrentUser = Depends(require_user),
                      db: Database = Depends(get_db)):
    pid = _uuid(post_id, "post")
    post = await db.fetchrow("SELECT user_id, content FROM posts WHERE id = $1", pid)
    if not post:
        raise NotFound("Post not found")
    parent_author = None
    if body.parent_id:
        parent = await db.fetchrow("SELECT user_id FROM comments WHERE id = $1 AND post_id = $2", body.parent_id, pid)
        if not parent:
            raise BadRequest("parent_id does not belong to this post")
        parent_author = parent["user_id"]
    cid = await db.fetchval("INSERT INTO comments (post_id, user_id, content, parent_id) VALUES ($1,$2,$3,$4) RETURNING id",
                            pid, user.id, body.content, body.parent_id)
    data = {"post_id": str(pid), "comment_id": str(cid), "actor_id": user.sid, "actor_username": user.username}
    who = user.display_name or user.username
    n = _notifier(request)
    await n.notify(post["user_id"], "comment", f"{who} commented on your post", _snippet(body.content), data, actor_id=user.id)
    if parent_author and parent_author != post["user_id"]:
        await n.notify(parent_author, "comment", f"{who} replied to your comment", _snippet(body.content), data, actor_id=user.id)
    row = await db.fetchrow(_COMMENT_SELECT + " WHERE c.id = $1", cid)
    return _comment(row)


@router.delete("/comments/{comment_id}")
async def delete_comment(comment_id: str, user: CurrentUser = Depends(require_user), db: Database = Depends(get_db)):
    if not is_uuid(comment_id):
        return {"success": True}
    row = await db.fetchrow("""SELECT c.user_id, p.user_id AS post_owner FROM comments c JOIN posts p ON p.id = c.post_id
                               WHERE c.id = $1""", uuid.UUID(comment_id))
    if not row:
        return {"success": True}  # idempotent
    if user.id not in (row["user_id"], row["post_owner"]) and not user.is_admin:
        raise Forbidden("You cannot delete this comment")
    await db.execute("DELETE FROM comments WHERE id = $1", uuid.UUID(comment_id))  # replies cascade
    return {"success": True}


# ───────────────────────────── stories, trending, experts ─────────────────────────────
@router.get("/stories")
async def stories(limit: int = Query(50, ge=1, le=100), db: Database = Depends(get_db)):
    rows = await db.fetch(
        """SELECT p.id, p.user_id, p.content, p.image_url, p.created_at, p.expires_at, u.username, u.display_name, u.avatar_url
           FROM posts p JOIN users u ON u.id = p.user_id
           WHERE p.is_story AND (p.expires_at IS NULL OR p.expires_at > NOW())
           ORDER BY p.created_at DESC LIMIT $1""", limit)
    return [{"id": str(r["id"]), "user_id": str(r["user_id"]), "content": r["content"], "image_url": r["image_url"],
             "created_at": r["created_at"], "expires_at": r["expires_at"],
             "user": {"id": str(r["user_id"]), "username": r["username"], "display_name": r["display_name"] or r["username"],
                      "avatar_url": avatar(r["avatar_url"], r["username"])}} for r in rows]


@router.post("/stories", status_code=201, dependencies=[Depends(rate_limit("story_create", 10))])
async def create_story(body: StoryCreate, user: CurrentUser = Depends(require_user), db: Database = Depends(get_db)):
    return await _create_post(body, user, db, story=True)


@router.get("/trending-symbols")
async def trending_symbols(db: Database = Depends(get_db)):
    """Assets most tagged (explicit tags or $cashtags) in feed posts over the last 7 days."""
    rows = await db.fetch(
        """SELECT a.symbol, count(*)::int AS posts FROM post_asset_tags t
           JOIN posts p ON p.id = t.post_id AND NOT p.is_story AND p.created_at > NOW() - INTERVAL '7 days'
           JOIN assets a ON a.id = t.asset_id
           GROUP BY a.symbol ORDER BY posts DESC, a.symbol LIMIT 5""")
    return [{"symbol": r["symbol"], "posts": r["posts"]} for r in rows]


@router.get("/featured-experts")
async def featured_experts(db: Database = Depends(get_db)):
    """Most-followed active accounts, preferring analysts/educators. No performance stats are fabricated."""
    rows = await db.fetch(
        """SELECT id, username, display_name, avatar_url, bio, role::text AS role, followers_count FROM users
           WHERE is_active
           ORDER BY (role IN ('analyst','verified_educator')) DESC, followers_count DESC, created_at DESC LIMIT 5""")
    return [{"id": str(r["id"]), "username": r["username"], "display_name": r["display_name"] or r["username"],
             "avatar_url": r["avatar_url"], "bio": r["bio"], "role": r["role"], "followers_count": r["followers_count"]}
            for r in rows]


# ───────────────────────────── users & follows ─────────────────────────────
_USER_SELECT = """SELECT u.id, u.username, u.display_name, u.avatar_url, u.bio, u.role::text AS role,
       COALESCE(u.preferred_broker, 'Exness') AS preferred_broker,
       u.followers_count, u.following_count, u.created_at,
       EXISTS(SELECT 1 FROM follows f WHERE f.follower_id = $1::uuid AND f.following_id = u.id) AS is_following,
       EXISTS(SELECT 1 FROM follows f WHERE f.following_id = $1::uuid AND f.follower_id = u.id) AS is_follower
FROM users u"""


@router.get("/users")
async def list_users(q: str = Query("", max_length=50), limit: int = Query(100, ge=1, le=100),
                     user: CurrentUser | None = Depends(optional_user), db: Database = Depends(get_db)):
    pattern = f"%{esc_like(q.strip())}%" if q.strip() else None
    rows = await db.fetch(
        _USER_SELECT + """ WHERE u.is_active AND ($2::text IS NULL OR u.username ILIKE $2 ESCAPE '\\'
                              OR u.display_name ILIKE $2 ESCAPE '\\')
                           ORDER BY u.created_at DESC, u.id LIMIT $3""", VIEWER(user), pattern, limit)
    return [user_public(r) for r in rows]


@router.post("/users", status_code=201, dependencies=[Depends(rate_limit("follow", 60))])
async def users_action(body: UserActionBody, request: Request, user: CurrentUser = Depends(require_user),
                       db: Database = Depends(get_db)):
    if body.following_id:  # legacy "follow via body"
        return {"success": True, **await _follow(request, user, db, body.following_id, force_follow=True)}
    if body.username:
        raise BadRequest("Traders join by registering; profiles cannot be created manually. Share the sign-up link instead.")
    raise BadRequest("Invalid request body")


async def _find_user(db: Database, ident: str, viewer: Any) -> dict[str, Any] | None:
    if is_uuid(ident):
        return await db.fetchrow(_USER_SELECT + " WHERE u.id = $2 AND u.is_active", viewer, uuid.UUID(ident))
    return await db.fetchrow(_USER_SELECT + " WHERE lower(u.username) = lower($2) AND u.is_active", viewer, ident)


@router.get("/users/{ident}")
async def get_user(ident: str, user: CurrentUser | None = Depends(optional_user), db: Database = Depends(get_db)):
    row = await _find_user(db, ident, VIEWER(user))
    if not row:
        raise NotFound("User not found")
    return user_public(row)


@router.get("/users/{ident}/posts")
async def user_posts(ident: str, limit: int = Query(20, ge=1, le=50), offset: int = Query(0, ge=0, le=10000),
                     user: CurrentUser | None = Depends(optional_user), db: Database = Depends(get_db)):
    target = await _find_user(db, ident, None)
    if not target:
        raise NotFound("User not found")
    return await list_posts(db, VIEWER(user), "p.is_story = false AND p.user_id = $2", [target["id"]],
                            "p.is_pinned DESC, p.created_at DESC, p.id DESC", limit, offset)


async def _follow(request: Request, user: CurrentUser, db: Database, target: uuid.UUID, force_follow: bool = False) -> dict:
    if target == user.id:
        raise BadRequest("Cannot follow yourself")
    if not await db.fetchval("SELECT 1 FROM users WHERE id = $1 AND is_active", target):
        raise NotFound("User not found")
    removed = None if force_follow else await db.fetchval(
        "DELETE FROM follows WHERE follower_id=$1 AND following_id=$2 RETURNING 1", user.id, target)
    is_following = removed is None
    if is_following:
        try:
            inserted = await db.fetchval(
                "INSERT INTO follows (follower_id, following_id) VALUES ($1,$2) ON CONFLICT DO NOTHING RETURNING 1", user.id, target)
        except asyncpg.ForeignKeyViolationError:
            raise NotFound("User not found") from None
        if inserted:
            await _notifier(request).notify(
                target, "follow", f"{user.display_name or user.username} started following you", "",
                {"actor_id": user.sid, "actor_username": user.username}, actor_id=user.id, dedupe_hours=1)
    followers = await db.fetchval("SELECT followers_count FROM users WHERE id = $1", target)
    return {"is_following": is_following, "followers_count": followers or 0}


@router.post("/users/{target_id}/follow", dependencies=[Depends(rate_limit("follow", 60))])
async def toggle_follow(target_id: str, request: Request, user: CurrentUser = Depends(require_user),
                        db: Database = Depends(get_db)):
    return await _follow(request, user, db, _uuid(target_id, "user"))
