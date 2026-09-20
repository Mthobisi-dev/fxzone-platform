"""Supabase Auth Admin API (service-role): profile metadata sync and account deletion."""
from __future__ import annotations

import logging
from typing import Any

import httpx

from ..config import Settings

log = logging.getLogger("fxzone.supabase_admin")


class SupabaseAdmin:
    def __init__(self, settings: Settings, http: httpx.AsyncClient) -> None:
        self._url = f"{settings.supabase_url}/auth/v1/admin/users" if settings.supabase_url else None
        self._key = settings.supabase_service_role_key
        self.http = http

    @property
    def enabled(self) -> bool:
        return bool(self._url and self._key)

    def _headers(self) -> dict[str, str]:
        return {"apikey": self._key or "", "Authorization": f"Bearer {self._key}", "Content-Type": "application/json"}

    async def update_metadata(self, user_id: str, patch: dict[str, Any]) -> bool:
        """Merge `patch` into user_metadata (best effort; the DB row stays authoritative)."""
        if not self.enabled:
            return False
        try:
            cur = await self.http.get(f"{self._url}/{user_id}", headers=self._headers(), timeout=8)
            existing = (cur.json().get("user_metadata") or {}) if cur.status_code == 200 else {}
            r = await self.http.put(f"{self._url}/{user_id}", headers=self._headers(), timeout=8,
                                    json={"user_metadata": {**existing, **patch}})
            return r.status_code < 300
        except httpx.HTTPError as e:
            log.warning("metadata sync failed: %s", e)
            return False

    async def delete_user(self, user_id: str) -> bool:
        """True when the auth identity is gone (404 counts: already deleted)."""
        if not self.enabled:
            return False
        try:
            r = await self.http.delete(f"{self._url}/{user_id}", headers=self._headers(), timeout=10)
            return r.status_code < 300 or r.status_code == 404
        except httpx.HTTPError as e:
            log.error("auth user delete failed: %s", e)
            return False
