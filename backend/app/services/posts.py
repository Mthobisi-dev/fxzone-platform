"""Shared SQL + serialisation for posts, users and comments."""
from __future__ import annotations

import re
import uuid
from typing import Any

from ..db import Database

DICEBEAR = "https://api.dicebear.com/8.x/initials/svg?seed={}"
_UUID_RE = re.compile(r"^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$")


def is_uuid(v: str) -> bool:
    return bool(_UUID_RE.match(v or ""))


def avatar(url: str | None, username: str | None) -> str:
    return url or DICEBEAR.format(username or "user")


# $1 is ALWAYS the viewer id (NULL for anonymous). Extra params start at $2.
POST_SELECT = """
SELECT p.id, p.user_id, p.content, p.image_url, p.caption, p.likes_count, p.comments_count, p.reposts_count,
       p.is_story, p.is_pinned, p.expires_at, p.created_at,
       p.show_comments_count, p.show_likes_count, p.allow_reshare, p.allow_save, p.allow_share,
       u.username, u.display_name, u.avatar_url, u.role::text AS role,
       COALESCE((SELECT array_agg(a.symbol ORDER BY a.symbol) FROM post_asset_tags t
                 JOIN assets a ON a.id = t.asset_id WHERE t.post_id = p.id), '{}') AS asset_tags,
       EXISTS(SELECT 1 FROM reactions r WHERE r.post_id = p.id AND r.user_id = $1::uuid AND r.reaction_type = 'like') AS is_liked_by_user,
       EXISTS(SELECT 1 FROM reposts rp WHERE rp.post_id = p.id AND rp.user_id = $1::uuid) AS is_reposted_by_user,
       EXISTS(SELECT 1 FROM bookmarks b WHERE b.post_id = p.id AND b.user_id = $1::uuid) AS is_bookmarked_by_user
FROM posts p JOIN users u ON u.id = p.user_id
"""


def post_to_api(r: dict[str, Any]) -> dict[str, Any]:
    uid = str(r["user_id"])
    return {
        "id": str(r["id"]), "user_id": uid,
        "user": {"id": uid, "username": r["username"], "display_name": r["display_name"] or r["username"],
                 "full_name": r["display_name"] or r["username"], "avatar_url": avatar(r["avatar_url"], r["username"]),
                 "role": r["role"]},
        "content": r["content"], "image_url": r["image_url"], "caption": r["caption"],
        "media_type": "image" if r["image_url"] else "none",
        "asset_tags": list(r["asset_tags"] or []),
        "likes_count": r["likes_count"] or 0, "comments_count": r["comments_count"] or 0,
        "reposts_count": r["reposts_count"] or 0,
        "show_comments_count": r["show_comments_count"], "show_likes_count": r["show_likes_count"],
        "allow_reshare": r["allow_reshare"], "allow_save": r["allow_save"], "allow_share": r["allow_share"],
        "is_liked_by_user": r["is_liked_by_user"], "is_reposted_by_user": r["is_reposted_by_user"],
        "is_bookmarked_by_user": r["is_bookmarked_by_user"],
        "is_story": r["is_story"], "is_pinned": r["is_pinned"], "expires_at": r["expires_at"],
        "created_at": r["created_at"],
    }


async def fetch_post(db: Database, viewer_id: Any, post_id: uuid.UUID) -> dict[str, Any] | None:
    row = await db.fetchrow(POST_SELECT + " WHERE p.id = $2", viewer_id, post_id)
    return post_to_api(row) if row else None


async def list_posts(db: Database, viewer_id: Any, where: str, params: list[Any], order: str, limit: int, offset: int) -> list[dict[str, Any]]:
    n = len(params) + 1  # placeholders used so far ($1 + params)
    rows = await db.fetch(f"{POST_SELECT} WHERE {where} ORDER BY {order} LIMIT ${n + 1} OFFSET ${n + 2}",
                          viewer_id, *params, limit, offset)
    return [post_to_api(r) for r in rows]


async def resolve_tags(db: Database, explicit: list[str], content: str) -> list[uuid.UUID]:
    """Explicit tags + $CASHTAGS found in the text, restricted to real assets."""
    wanted = {t.strip().lstrip("$").upper() for t in explicit if t and t.strip()}
    wanted |= {m.upper() for m in re.findall(r"\$([A-Za-z]{2,10})\b", content or "")}
    if not wanted:
        return []
    rows = await db.fetch("SELECT id FROM assets WHERE symbol = ANY($1::text[]) AND is_active", sorted(wanted)[:20])
    return [r["id"] for r in rows]


def user_public(r: dict[str, Any]) -> dict[str, Any]:
    """Profile shape used by discover/profile pages (never includes email)."""
    dn = r.get("display_name") or r["username"]
    d = {
        "id": str(r["id"]), "username": r["username"], "display_name": dn, "displayName": dn,
        "avatar_url": r.get("avatar_url"), "avatarUrl": r.get("avatar_url"),
        "bio": r.get("bio"), "role": r.get("role"),
        "preferred_broker": r.get("preferred_broker") or "Exness", "preferredBroker": r.get("preferred_broker") or "Exness",
        "followers_count": r.get("followers_count") or 0, "followersCount": r.get("followers_count") or 0,
        "following_count": r.get("following_count") or 0, "followingCount": r.get("following_count") or 0,
        "created_at": r.get("created_at"),
    }
    if "is_following" in r:
        d.update(is_following=r["is_following"], isFollowing=r["is_following"],
                 is_follower=r["is_follower"], is_mutual=r["is_following"] and r["is_follower"])
    return d
