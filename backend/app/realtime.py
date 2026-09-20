"""Publishes server-authoritative events to Supabase Realtime via its HTTP broadcast API.

The frontend subscribes with supabase.channel(<name>) (see frontend/lib/websocket.ts, which turns
"/ws/chat/123" into the channel "chat_123"), so the topic names below MUST match that scheme.
Publishing never blocks or fails a request: errors are logged and dropped.
"""
from __future__ import annotations

import asyncio
import logging
import re
from typing import Any

import httpx

from .config import Settings

log = logging.getLogger("fxzone.realtime")

MARKET_TOPIC = "market"
NEWS_TOPIC = "news"


def sanitize_topic(path: str) -> str:
    """Mirror of FxZoneWebSocket's channel-name sanitising in the frontend."""
    p = re.sub(r"^/ws/", "", path)
    p = re.sub(r"^/", "", p)
    p = re.sub(r"[^a-zA-Z0-9_-]", "_", p)
    return p or "fxzone_global"


def chat_topic(conversation_id: Any) -> str:
    return sanitize_topic(f"/ws/chat/{conversation_id}")


def session_topic(session_id: Any) -> str:
    return sanitize_topic(f"/ws/session/{session_id}")


def notifications_topic(user_id: Any) -> str:
    return sanitize_topic(f"/ws/notifications/{user_id}")


class RealtimePublisher:
    def __init__(self, settings: Settings, http: httpx.AsyncClient) -> None:
        self._url = f"{settings.supabase_url}/realtime/v1/api/broadcast" if settings.supabase_url else None
        self._key = settings.supabase_service_role_key
        self._http = http
        self._tasks: set[asyncio.Task] = set()
        self.enabled = bool(self._url and self._key)
        if not self.enabled:
            log.warning("realtime disabled (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set); clients fall back to polling")
        self.published = 0
        self.failed = 0

    async def publish(self, topic: str, event: str, payload: dict[str, Any]) -> bool:
        if not self.enabled:
            return False
        body = {"messages": [{"topic": topic, "event": event, "payload": payload, "private": False}]}
        headers = {"apikey": self._key, "Authorization": f"Bearer {self._key}", "Content-Type": "application/json"}
        for attempt in (1, 2):
            try:
                r = await self._http.post(self._url, json=body, headers=headers, timeout=4.0)
                if r.status_code < 300:
                    self.published += 1
                    return True
                if r.status_code < 500:
                    log.warning("realtime rejected %s/%s: %s %s", topic, event, r.status_code, r.text[:200])
                    break
            except httpx.HTTPError as e:
                log.warning("realtime publish error (attempt %s): %s", attempt, e)
        self.failed += 1
        return False

    def publish_nowait(self, topic: str, event: str, payload: dict[str, Any]) -> None:
        """Fire-and-forget from a request handler."""
        if not self.enabled:
            return
        task = asyncio.get_running_loop().create_task(self.publish(topic, event, payload))
        self._tasks.add(task)
        task.add_done_callback(self._tasks.discard)

    async def drain(self) -> None:
        if self._tasks:
            await asyncio.gather(*list(self._tasks), return_exceptions=True)
