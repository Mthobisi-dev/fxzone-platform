import asyncio
import pytest
from pydantic import ValidationError

from app.cache import Cache, SingleFlight
from tests.conftest import make_settings, token_for
import uuid


async def test_health_and_readiness(client):
    assert (await client.get("/health")).json() == {"status": "ok"}
    r = await client.get("/health/ready")
    assert r.status_code == 200
    body = r.json()
    assert body["checks"]["database"] is True and body["checks"]["redis"] == "disabled"
    assert body["features"]["realtime_broadcast"] is True and body["features"]["gemini"] is False


async def test_request_id_and_security_headers(client):
    r = await client.get("/health", headers={"X-Request-ID": "abcdef123456"})
    assert r.headers["x-request-id"] == "abcdef123456"
    assert r.headers["x-content-type-options"] == "nosniff" and r.headers["x-frame-options"] == "DENY"
    r2 = await client.get("/health", headers={"X-Request-ID": "bad id with spaces & <script>"})
    assert r2.headers["x-request-id"] != "bad id with spaces & <script>"  # never reflect junk
    assert (await client.get("/api/market/assets")).headers["cache-control"].startswith("public")
    assert (await client.get("/api/social/feed")).headers["cache-control"] == "no-store"


async def test_error_shape_has_detail_for_frontend(client):
    r = await client.get("/api/auth/me")
    assert r.status_code == 401 and r.json()["detail"] == "Not authenticated" and r.json()["code"] == "unauthorized"
    assert r.headers["www-authenticate"] == "Bearer"
    r = await client.get("/api/social/feed?limit=9999")
    assert r.status_code == 422 and "limit" in r.json()["detail"]
    r = await client.get("/nope")
    assert r.status_code == 404 and "detail" in r.json()


async def test_json_body_size_limit(client, alice):
    big = {"content": "x" * 1_200_000}
    r = await client.post("/api/social/posts", json=big, headers=alice.headers)
    assert r.status_code == 413 and r.json()["code"] in ("payload_too_large", "http_error")


async def test_rate_limit_returns_429_with_retry_after(app, client, alice):
    # the limiter reads its per-route limit at import time; use the tight AI chat limit (12/min)
    codes = [(await client.post("/api/ai/chat", json={"message": "hello"}, headers=alice.headers)).status_code for _ in range(14)]
    assert codes[:12] == [200] * 12 and codes[12:] == [429, 429]
    r = await client.post("/api/ai/chat", json={"message": "hello"}, headers=alice.headers)
    assert int(r.headers["retry-after"]) >= 1 and r.headers["x-ratelimit-remaining"] == "0"


async def test_rate_limit_is_per_user(client, alice, bob):
    for _ in range(12):
        await client.post("/api/ai/chat", json={"message": "hi"}, headers=alice.headers)
    assert (await client.post("/api/ai/chat", json={"message": "hi"}, headers=alice.headers)).status_code == 429
    assert (await client.post("/api/ai/chat", json={"message": "hi"}, headers=bob.headers)).status_code == 200


async def test_invalid_tokens_are_throttled(client):
    codes = [(await client.get("/api/auth/me", headers={"Authorization": "Bearer junk.junk.junk"})).status_code for _ in range(33)]
    assert codes[0] == 401 and codes[-1] == 429


def test_production_config_refuses_unsafe_setup():
    with pytest.raises(ValidationError) as e:
        make_settings(environment="production")  # ssl disabled, no redis, local storage...
    msg = str(e.value)
    assert "DATABASE_SSL" in msg and "REDIS_URL" in msg and "STORAGE_BACKEND=local" in msg
    ok = make_settings(environment="production", database_ssl="require", redis_url="redis://x", storage_backend="supabase")
    assert ok.is_production
    with pytest.raises(ValidationError):
        make_settings(environment="production", database_ssl="require", redis_url="redis://x", storage_backend="supabase", cors_origins="*")


async def test_redis_backend_primitives():
    cache = Cache(make_settings(redis_url="redis://localhost:6379/15"))
    await cache.connect()
    try:
        assert cache.backend == "redis" and await cache.ping() is True
        await cache.set_json("t:k", {"a": 1}, 5)
        assert await cache.get_json("t:k") == {"a": 1}
        key = f"rl:{uuid.uuid4()}"
        assert [c for c, _ in [await cache.hit(key, 30) for _ in range(3)]] == [1, 2, 3]
        tok = await cache.acquire_lock("t-lock", 5)
        assert tok and await cache.acquire_lock("t-lock", 5) is None       # second holder refused
        assert await cache.acquire_lock("t-lock", 5, tok) == tok           # holder can renew
        await cache.release_lock("t-lock", tok)
        assert await cache.acquire_lock("t-lock", 5)                       # free again
        await cache.release_lock("t-lock", (await cache._redis.get("lock:t-lock")))
    finally:
        await cache._redis.flushdb()
        await cache.close()


async def test_redis_required_at_startup_when_configured_but_down():
    cache = Cache(make_settings(redis_url="redis://localhost:6390/0"))  # nothing listens there
    with pytest.raises(Exception):
        await cache.connect()  # fail fast rather than silently degrade


async def test_single_flight_collapses_concurrent_calls():
    sf, calls = SingleFlight(), 0

    async def work():
        nonlocal calls
        calls += 1
        await asyncio.sleep(0.05)
        return "v"

    results = await asyncio.gather(*(sf.run("k", work) for _ in range(10)))
    assert results == ["v"] * 10 and calls == 1
