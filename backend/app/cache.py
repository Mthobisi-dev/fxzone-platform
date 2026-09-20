"""Redis-backed cache/rate-limit/lock primitives with an explicit in-memory fallback.
The fallback is only permitted in production when ALLOW_IN_MEMORY_STATE=true (single instance)."""
from __future__ import annotations

import asyncio
import json
import logging
import secrets
import time
from typing import Any

from .config import Settings

log = logging.getLogger("fxzone.cache")

_RELEASE_LUA = "if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end"


class Cache:
    def __init__(self, settings: Settings) -> None:
        self._settings = settings
        self._redis = None
        self._mem: dict[str, tuple[float, str]] = {}
        self._counters: dict[str, tuple[float, int]] = {}
        self._locks: dict[str, tuple[float, str]] = {}
        self.backend = "memory"

    async def connect(self) -> None:
        if not self._settings.redis_url:
            if self._settings.is_production:
                log.warning("running with IN-MEMORY state (no REDIS_URL): rate limits and caches are per-process")
            return
        import redis.asyncio as aioredis

        self._redis = aioredis.from_url(self._settings.redis_url, decode_responses=True,
                                        socket_timeout=2, socket_connect_timeout=2, health_check_interval=30)
        await self._redis.ping()  # fail fast on misconfiguration instead of silently degrading
        self.backend = "redis"
        log.info("redis connected")

    async def close(self) -> None:
        if self._redis:
            await self._redis.aclose()

    async def ping(self) -> bool | None:
        """True/False for redis health, None when redis is not configured."""
        if not self._redis:
            return None
        try:
            return bool(await self._redis.ping())
        except Exception:  # noqa: BLE001
            return False

    # ── json values ────────────────────────────────────────────────────────
    async def get_json(self, key: str) -> Any | None:
        try:
            if self._redis:
                raw = await self._redis.get(key)
            else:
                item = self._mem.get(key)
                raw = item[1] if item and item[0] > time.monotonic() else None
            return json.loads(raw) if raw else None
        except Exception as e:  # noqa: BLE001
            log.warning("cache get failed for %s: %s", key, e)
            return None

    async def set_json(self, key: str, value: Any, ttl: int) -> None:
        try:
            raw = json.dumps(value, default=str)
            if self._redis:
                await self._redis.set(key, raw, ex=ttl)
            else:
                self._mem[key] = (time.monotonic() + ttl, raw)
                if len(self._mem) > 5000:
                    self._sweep()
        except Exception as e:  # noqa: BLE001
            log.warning("cache set failed for %s: %s", key, e)

    async def delete(self, key: str) -> None:
        try:
            if self._redis:
                await self._redis.delete(key)
            else:
                self._mem.pop(key, None)
        except Exception as e:  # noqa: BLE001
            log.warning("cache delete failed for %s: %s", key, e)

    def _sweep(self) -> None:
        now = time.monotonic()
        self._mem = {k: v for k, v in self._mem.items() if v[0] > now}
        self._counters = {k: v for k, v in self._counters.items() if v[0] > now}

    # ── fixed-window counter (rate limiting) ───────────────────────────────
    async def hit(self, key: str, window: int) -> tuple[int, int]:
        """Increment a counter; returns (count_in_window, seconds_until_reset). Fails OPEN on redis errors."""
        try:
            if self._redis:
                pipe = self._redis.pipeline()
                pipe.incr(key)
                pipe.ttl(key)
                count, ttl = await pipe.execute()
                if ttl == -1:
                    await self._redis.expire(key, window)
                    ttl = window
                return int(count), max(int(ttl), 1)
            now = time.monotonic()
            expires, count = self._counters.get(key, (0.0, 0))
            if expires <= now:
                expires, count = now + window, 0
            count += 1
            self._counters[key] = (expires, count)
            if len(self._counters) > 20000:
                self._sweep()
            return count, max(int(expires - now), 1)
        except Exception as e:  # noqa: BLE001
            log.warning("rate-limit backend error (failing open): %s", e)
            return 0, window

    # ── distributed lock (leader election for background jobs) ─────────────
    async def acquire_lock(self, name: str, ttl: int, token: str | None = None) -> str | None:
        token = token or secrets.token_hex(8)
        try:
            if self._redis:
                ok = await self._redis.set(f"lock:{name}", token, nx=True, ex=ttl)
                if ok:
                    return token
                # allow the current holder to renew
                if await self._redis.get(f"lock:{name}") == token:
                    await self._redis.expire(f"lock:{name}", ttl)
                    return token
                return None
            now = time.monotonic()
            held = self._locks.get(name)
            if held is None or held[0] <= now or held[1] == token:
                self._locks[name] = (now + ttl, token)
                return token
            return None
        except Exception as e:  # noqa: BLE001
            log.warning("lock backend error: %s", e)
            return None

    async def release_lock(self, name: str, token: str) -> None:
        try:
            if self._redis:
                await self._redis.eval(_RELEASE_LUA, 1, f"lock:{name}", token)
            elif self._locks.get(name, (0, ""))[1] == token:
                self._locks.pop(name, None)
        except Exception as e:  # noqa: BLE001
            log.warning("lock release error: %s", e)


class SingleFlight:
    """Collapse concurrent identical async calls into one (protects upstream APIs)."""

    def __init__(self) -> None:
        self._inflight: dict[str, asyncio.Future] = {}

    async def run(self, key: str, factory):
        if key in self._inflight:
            return await asyncio.shield(self._inflight[key])
        fut: asyncio.Future = asyncio.get_running_loop().create_future()
        self._inflight[key] = fut
        try:
            result = await factory()
            fut.set_result(result)
            return result
        except BaseException as e:  # noqa: BLE001
            fut.set_exception(e)
            fut.exception()  # mark retrieved so asyncio doesn't warn when nobody else awaited
            raise
        finally:
            self._inflight.pop(key, None)
