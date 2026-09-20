"""Notification creation (persisted, then pushed to the recipient's private realtime channel)."""
from __future__ import annotations

import logging
from typing import Any

from ..db import Database
from ..realtime import RealtimePublisher, notifications_topic

log = logging.getLogger("fxzone.notifications")


def notification_to_api(r: dict[str, Any]) -> dict[str, Any]:
    return {"id": str(r["id"]), "user_id": str(r["user_id"]), "type": r["type"], "title": r["title"],
            "message": r["message"] or "", "data": r["data"] or {}, "is_read": bool(r["is_read"]),
            "created_at": r["created_at"]}


class Notifier:
    def __init__(self, db: Database, realtime: RealtimePublisher) -> None:
        self.db, self.realtime = db, realtime

    async def notify(self, user_id: Any, type_: str, title: str, message: str = "", data: dict | None = None,
                     actor_id: Any = None, dedupe_hours: float | None = None) -> None:
        """Best-effort: a failed notification must never fail the action that triggered it."""
        if actor_id is not None and str(actor_id) == str(user_id):
            return
        try:
            data = data or {}
            if dedupe_hours:
                exists = await self.db.fetchval(
                    """SELECT 1 FROM notifications WHERE user_id = $1 AND type = $2 AND data = $3::jsonb
                       AND created_at > NOW() - make_interval(secs => $4) LIMIT 1""",
                    user_id, type_, data, float(dedupe_hours) * 3600)
                if exists:
                    return
            row = await self.db.fetchrow(
                """INSERT INTO notifications (user_id, type, title, message, data) VALUES ($1,$2,$3,$4,$5)
                   RETURNING id, user_id, type, title, message, data, is_read, created_at""",
                user_id, type_, title[:200], message[:1000], data)
            if row:
                self.realtime.publish_nowait(notifications_topic(user_id), "notification",
                                             {"notification": _jsonable(notification_to_api(row))})
        except Exception as e:  # noqa: BLE001
            log.warning("notify failed (%s -> %s): %s", type_, user_id, e)

    async def notify_followers(self, host_id: Any, type_: str, title: str, message: str, data: dict, cap: int = 500) -> int:
        rows = await self.db.fetch(
            """INSERT INTO notifications (user_id, type, title, message, data)
               SELECT f.follower_id, $2, $3, $4, $5 FROM follows f WHERE f.following_id = $1 LIMIT $6
               RETURNING id, user_id, type, title, message, data, is_read, created_at""",
            host_id, type_, title[:200], message[:1000], data, cap)
        for r in rows:
            self.realtime.publish_nowait(notifications_topic(r["user_id"]), "notification",
                                         {"notification": _jsonable(notification_to_api(r))})
        return len(rows)


def _jsonable(d: dict[str, Any]) -> dict[str, Any]:
    from fastapi.encoders import jsonable_encoder
    return jsonable_encoder(d)
