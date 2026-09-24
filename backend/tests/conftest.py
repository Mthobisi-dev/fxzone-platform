"""Integration-test harness: real Postgres (schema + ALL migrations), real Redis (optional), mocked network.

Requires: psql on PATH and a Postgres reachable at TEST_PG_BASE (default postgresql://postgres:postgres@localhost:5432).
Run:  pytest            (it rebuilds the `fxzone_test` database from supabase_schema.sql + supabase/migrations/)
"""
from __future__ import annotations

import json
import os
import shutil
import subprocess
import sys
import time
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path

import httpx
import jwt
import pytest
import pytest_asyncio
import respx

from app.config import Settings
from app.main import create_app

HERE = Path(__file__).parent
PG_BASE = os.environ.get("TEST_PG_BASE", "postgresql://postgres:postgres@localhost:5432")
DB_NAME = "fxzone_test"
SECRET = "test-jwt-secret-with-enough-length-for-hs256"
SUPABASE_URL = "https://test.supabase.co"


def make_settings(**over) -> Settings:
    base = dict(environment="test", database_url=f"{PG_BASE}/{DB_NAME}", supabase_url=SUPABASE_URL,
                supabase_service_role_key="service-key", supabase_jwt_secret=SECRET, redis_url=None,
                storage_backend="local", upload_dir=str(HERE / ".uploads"), public_base_url="http://testserver",
                enable_background_tasks=False, asset_sync_on_startup=True, gemini_api_key=None, log_level="WARNING",
                rate_limit_default_per_minute=10_000, rate_limit_anonymous_per_minute=10_000)
    base.update(over)
    return Settings(**base)


@pytest.fixture(scope="session")
def database():
    if not shutil.which("psql"):
        pytest.skip("Postgres integration tests require psql and a running PostgreSQL server; use backend/docker-compose.yml")
    subprocess.run(
        [sys.executable, str(HERE / "sql" / "apply.py"), PG_BASE, DB_NAME],
        check=True,
        capture_output=True,
        text=True,
    )


class Net:
    """Handles on the mocked outbound network."""

    def __init__(self, router: respx.MockRouter):
        self.router = router
        self.realtime = router.post(f"{SUPABASE_URL}/realtime/v1/api/broadcast").mock(return_value=httpx.Response(200, json={}))
        self.coingecko = router.get(url__startswith="https://api.coingecko.com/")
        self.yahoo = router.get(url__regex=r"https://query1\.finance\.yahoo\.com/v8/finance/chart/.*")
        self.admin_delete = router.delete(url__regex=rf"{SUPABASE_URL}/auth/v1/admin/users/.*").mock(return_value=httpx.Response(200, json={}))
        self.admin_get = router.get(url__regex=rf"{SUPABASE_URL}/auth/v1/admin/users/.*").mock(return_value=httpx.Response(200, json={"user_metadata": {}}))
        self.admin_put = router.put(url__regex=rf"{SUPABASE_URL}/auth/v1/admin/users/.*").mock(return_value=httpx.Response(200, json={}))
        self.gemini = router.post(url__startswith="https://generativelanguage.googleapis.com/")
        self.rss = router.get(url__startswith="https://feeds.example.com/")
        self.reset_market()

    def reset_market(self, up: bool = True):
        self.coingecko.mock(side_effect=lambda req: httpx.Response(200, json={
            "bitcoin": {"usd": 60000.5, "usd_24h_change": 2.5, "usd_24h_vol": 1.2e9},
            "ethereum": {"usd": 3000.25, "usd_24h_change": -1.0, "usd_24h_vol": 5e8}}))
        self.yahoo.mock(side_effect=lambda req: httpx.Response(200, json=yahoo_payload(req, up=up)))

    def topics(self, event: str | None = None) -> list[tuple[str, str, dict]]:
        out = []
        for call in self.realtime.calls:
            for m in json.loads(call.request.content)["messages"]:
                if event is None or m["event"] == event:
                    out.append((m["topic"], m["event"], m["payload"]))
        return out


def yahoo_payload(req: httpx.Request, up: bool = True, n: int | None = None) -> dict:
    """Deterministic synthetic candles shaped like Yahoo's v8 chart response."""
    interval = req.url.params.get("interval", "1d")
    step = {"1m": 60, "5m": 300, "15m": 900, "60m": 3600, "1d": 86400}[interval]
    count = n or {"1d": 320, "60m": 240}.get(interval, 120)
    end = (int(time.time()) // step) * step
    stamps = [end - (count - 1 - i) * step for i in range(count)]
    base, drift = 100.0, (0.6 if up else -0.6)
    close = [base + drift * i + ((i % 5) - 2) * 0.4 for i in range(count)]
    if not up:
        close = [max(c, 5.0) + 200 for c in close]
    quote = {"open": [c - 0.2 for c in close], "high": [c + 1.0 for c in close], "low": [c - 1.0 for c in close],
             "close": close, "volume": [1000 + i for i in range(count)]}
    return {"chart": {"result": [{"meta": {"regularMarketPrice": close[-1], "chartPreviousClose": close[-2],
                                           "regularMarketDayHigh": close[-1] + 1, "regularMarketDayLow": close[-1] - 1,
                                           "regularMarketVolume": 123456},
                                  "timestamp": stamps, "indicators": {"quote": [quote]}}], "error": None}}


@pytest_asyncio.fixture(scope="session")
async def app(database):
    application = create_app(make_settings())
    async with application.router.lifespan_context(application):
        yield application


@pytest_asyncio.fixture(autouse=True)
async def net(app):
    with respx.mock(assert_all_mocked=True, assert_all_called=False) as router:
        yield Net(router)


@pytest_asyncio.fixture(autouse=True)
async def clean(app):
    """Isolate tests: wipe user data + in-process caches (assets stay: they are synced at startup)."""
    await app.state.db.execute("TRUNCATE auth.users, news_articles CASCADE")
    c = app.state.cache
    c._mem.clear(); c._counters.clear(); c._locks.clear()
    app.state.realtime.published = app.state.realtime.failed = 0
    yield


@pytest_asyncio.fixture
async def client(app):
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://testserver") as c:
        yield c


def token_for(uid, *, email=None, secret=SECRET, exp_in=3600, aud="authenticated", iss=f"{SUPABASE_URL}/auth/v1", meta=None, alg="HS256", extra=None):
    claims = {"sub": str(uid), "aud": aud, "iss": iss, "role": "authenticated", "email": email or f"{uid}@t.io",
              "exp": datetime.now(timezone.utc) + timedelta(seconds=exp_in), "user_metadata": meta or {}}
    claims.update(extra or {})
    return jwt.encode(claims, secret, algorithm=alg)


class Who:
    def __init__(self, id, username, headers):
        self.id, self.username, self.headers = id, username, headers

    def __str__(self):
        return str(self.id)


@pytest_asyncio.fixture
async def make_user(app):
    async def factory(username: str = "alice", role: str = "trader", display_name: str | None = None) -> Who:
        uid = uuid.uuid4()
        db = app.state.db
        await db.execute("INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES ($1, $2, $3::jsonb)",
                         uid, f"{username}@t.io", {"username": username})  # dict: the pool's jsonb codec encodes it. DB trigger creates public.users
        await db.execute("UPDATE users SET username = $2, display_name = $3, role = $4::user_role WHERE id = $1",
                         uid, username, display_name or username.title(), role)
        return Who(uid, username, {"Authorization": f"Bearer {token_for(uid)}"})
    return factory


@pytest_asyncio.fixture
async def alice(make_user):
    return await make_user("alice")


@pytest_asyncio.fixture
async def bob(make_user):
    return await make_user("bob")


@pytest_asyncio.fixture
async def admin(make_user):
    return await make_user("root", role="admin")
