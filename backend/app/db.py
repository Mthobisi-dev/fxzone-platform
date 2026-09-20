"""asyncpg pool wrapper. Works with the Supabase pooler (transaction mode) because prepared
statements are disabled (statement_cache_size=0) and no session-level SET is relied upon."""
from __future__ import annotations

import json
import logging
import ssl
from contextlib import asynccontextmanager
from typing import Any, AsyncIterator, Awaitable, Callable, TypeVar

import asyncpg

from .config import Settings

log = logging.getLogger("fxzone.db")
T = TypeVar("T")


def build_ssl_context(settings: Settings) -> ssl.SSLContext | bool:
    mode = settings.database_ssl
    if mode == "disable":
        return False
    if mode == "verify-full":
        ctx = ssl.create_default_context(cafile=settings.database_ssl_root_cert)
        ctx.check_hostname = True
        ctx.verify_mode = ssl.CERT_REQUIRED
        return ctx
    # "require": encrypted but the server certificate is NOT verified (same as libpq sslmode=require)
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE
    if settings.is_production:
        log.warning("DATABASE_SSL=require encrypts traffic but does not verify the server certificate; "
                    "use verify-full with DATABASE_SSL_ROOT_CERT for production")
    return ctx


async def _init_connection(conn: asyncpg.Connection) -> None:
    await conn.set_type_codec("jsonb", encoder=json.dumps, decoder=json.loads, schema="pg_catalog")
    await conn.set_type_codec("json", encoder=json.dumps, decoder=json.loads, schema="pg_catalog")


class Database:
    def __init__(self) -> None:
        self.pool: asyncpg.Pool | None = None

    async def connect(self, settings: Settings) -> None:
        self.pool = await asyncpg.create_pool(
            dsn=settings.database_url,
            min_size=settings.db_pool_min,
            max_size=settings.db_pool_max,
            ssl=build_ssl_context(settings),
            statement_cache_size=0,
            command_timeout=settings.db_statement_timeout_ms / 1000,
            init=_init_connection,
        )
        log.info("database pool ready (min=%s max=%s)", settings.db_pool_min, settings.db_pool_max)

    async def close(self) -> None:
        if self.pool:
            await self.pool.close()
            self.pool = None

    def _pool(self) -> asyncpg.Pool:
        if self.pool is None:
            raise RuntimeError("database not connected")
        return self.pool

    async def fetch(self, query: str, *args: Any) -> list[dict[str, Any]]:
        async with self._pool().acquire() as conn:
            return [dict(r) for r in await conn.fetch(query, *args)]

    async def fetchrow(self, query: str, *args: Any) -> dict[str, Any] | None:
        async with self._pool().acquire() as conn:
            row = await conn.fetchrow(query, *args)
            return dict(row) if row else None

    async def fetchval(self, query: str, *args: Any) -> Any:
        async with self._pool().acquire() as conn:
            return await conn.fetchval(query, *args)

    async def execute(self, query: str, *args: Any) -> str:
        async with self._pool().acquire() as conn:
            return await conn.execute(query, *args)

    @asynccontextmanager
    async def transaction(self) -> AsyncIterator[asyncpg.Connection]:
        async with self._pool().acquire() as conn:
            async with conn.transaction():
                yield conn

    async def ping(self) -> bool:
        try:
            return (await self.fetchval("SELECT 1")) == 1
        except Exception:  # noqa: BLE001
            return False


async def retry_deadlock(fn: Callable[[], Awaitable[T]], attempts: int = 3) -> T:
    """Re-run an idempotent transaction if Postgres picks it as a deadlock victim."""
    for i in range(attempts):
        try:
            return await fn()
        except (asyncpg.DeadlockDetectedError, asyncpg.SerializationError):
            if i == attempts - 1:
                raise
    raise RuntimeError("unreachable")


def esc_like(term: str) -> str:
    """Escape LIKE wildcards in user input (used with ESCAPE '\\')."""
    return term.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
