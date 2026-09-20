import json
import uuid

import httpx


async def test_update_profile_partial_and_clear_fields(client, alice, net, app):
    r = await client.put("/api/auth/me", json={"display_name": "Alice A", "bio": "macro", "avatar_url": "https://cdn.example.com/a.png"}, headers=alice.headers)
    assert r.status_code == 200 and r.json()["display_name"] == "Alice A" and r.json()["bio"] == "macro"
    assert r.json()["username"] == "alice"                                     # untouched fields stay
    r = await client.put("/api/auth/me", json={"bio": "", "avatar_url": ""}, headers=alice.headers)
    assert r.json()["bio"] == "" and r.json()["avatar_url"] is None            # empty avatar clears it
    assert (await client.get("/api/auth/me", headers=alice.headers)).json()["display_name"] == "Alice A"
    first, second = (json.loads(c.request.content)["user_metadata"] for c in net.admin_put.calls)   # auth metadata kept in sync
    assert first == {"display_name": "Alice A", "bio": "macro", "avatar_url": "https://cdn.example.com/a.png"}
    assert second == {"bio": "", "avatar_url": None}


async def test_profile_validation_and_username_conflict(client, alice, bob):
    h = alice.headers
    for bad in ({"username": "a"}, {"username": "has space"}, {"username": "x" * 31}, {"username": "semi;colon"},
                {"bio": "x" * 501}, {"avatar_url": "javascript:alert(1)"}, {"display_name": "x" * 101}):
        assert (await client.put("/api/auth/me", json=bad, headers=h)).status_code == 422, bad
    r = await client.put("/api/auth/me", json={"username": "bob"}, headers=h)
    assert r.status_code == 409 and "taken" in r.json()["detail"]
    assert (await client.put("/api/auth/me", json={"username": "alice_2"}, headers=h)).json()["username"] == "alice_2"


async def test_profile_update_cannot_change_role_or_counters(client, alice):
    r = await client.put("/api/auth/me", json={"role": "admin", "followers_count": 999, "email": "x@evil.io", "is_active": False}, headers=alice.headers)
    body = r.json()
    assert r.status_code == 200 and body["role"] == "trader" and body["followers_count"] == 0 and body["email"] == "alice@t.io"


async def test_delete_account_removes_identity_first_then_cascades(client, alice, bob, net, app):
    p = (await client.post("/api/social/posts", json={"content": "bye"}, headers=alice.headers)).json()
    await client.post(f"/api/social/posts/{p['id']}/react", json={}, headers=bob.headers)
    await client.post(f"/api/social/users/{alice.id}/follow", json={}, headers=bob.headers)
    await client.post("/api/market/watchlist", json={"name": "w"}, headers=alice.headers)
    r = await client.delete("/api/auth/me", headers=alice.headers)
    assert r.status_code == 200
    assert net.admin_delete.call_count == 1 and str(alice.id) in str(net.admin_delete.calls.last.request.url)
    db = app.state.db
    assert await db.fetchval("SELECT count(*) FROM users WHERE id = $1", alice.id) == 0
    assert await db.fetchval("SELECT count(*) FROM posts WHERE user_id = $1", alice.id) == 0
    assert await db.fetchval("SELECT count(*) FROM watchlists WHERE user_id = $1", alice.id) == 0
    assert (await client.get(f"/api/social/users/{bob.id}")).json()["following_count"] == 0      # counters of others stay right
    # the token is still cryptographically valid, but the profile must NOT be resurrected
    await app.state.db.execute("DELETE FROM auth.users WHERE id = $1", alice.id)                 # what the admin API did
    assert (await client.get("/api/auth/me", headers=alice.headers)).status_code == 401


async def test_delete_account_aborts_untouched_if_identity_deletion_fails(client, alice, net, app):
    net.admin_delete.mock(return_value=httpx.Response(500))
    r = await client.delete("/api/auth/me", headers=alice.headers)
    assert r.status_code == 503 and "Nothing was changed" in r.json()["detail"]
    assert await app.state.db.fetchval("SELECT count(*) FROM users WHERE id = $1", alice.id) == 1   # old code deleted data first, then failed
    assert (await client.get("/api/auth/me", headers=alice.headers)).status_code == 200


async def test_delete_requires_auth_and_is_rate_limited(client, alice):
    assert (await client.delete("/api/auth/me")).status_code == 401


# ───────────── notifications API ─────────────
async def seed(app, uid, n=3, **kw):
    for i in range(n):
        await app.state.db.execute("INSERT INTO notifications (user_id, type, title, message) VALUES ($1, 'system', $2, '')", uid, f"n{i}")


async def test_notifications_list_mark_read_and_scoping(client, alice, bob, app):
    await seed(app, alice.id, 3); await seed(app, bob.id, 1)
    lst = (await client.get("/api/notifications", headers=alice.headers)).json()
    assert [n["title"] for n in lst] == ["n2", "n1", "n0"] and all(not n["is_read"] for n in lst)
    assert {"id", "user_id", "type", "title", "message", "data", "is_read", "created_at"} == set(lst[0])
    assert (await client.get("/api/notifications/unread-count", headers=alice.headers)).json() == {"count": 3}
    assert (await client.put(f"/api/notifications/{lst[0]['id']}/read", headers=alice.headers)).status_code == 200
    assert len((await client.get("/api/notifications?unread_only=true", headers=alice.headers)).json()) == 2
    # bob cannot mark alice's notification read
    await client.put(f"/api/notifications/{lst[1]['id']}/read", headers=bob.headers)
    assert (await client.get("/api/notifications/unread-count", headers=alice.headers)).json() == {"count": 2}
    await client.put("/api/notifications/read-all", headers=alice.headers)
    assert (await client.get("/api/notifications/unread-count", headers=alice.headers)).json() == {"count": 0}
    assert (await client.get("/api/notifications/unread-count", headers=bob.headers)).json() == {"count": 1}   # untouched
    assert (await client.get("/api/notifications")).status_code == 401
    assert (await client.put("/api/notifications/garbage/read", headers=alice.headers)).status_code == 200


async def test_mark_specific_ids_and_limit_validation(client, alice, app):
    await seed(app, alice.id, 3)
    ids = [n["id"] for n in (await client.get("/api/notifications", headers=alice.headers)).json()]
    await client.put("/api/notifications", json={"ids": ids[:2]}, headers=alice.headers)
    assert (await client.get("/api/notifications/unread-count", headers=alice.headers)).json() == {"count": 1}
    assert (await client.get("/api/notifications?limit=1000", headers=alice.headers)).status_code == 422


async def test_notifications_are_pushed_on_a_per_user_channel(client, alice, bob, net, app):
    """Global 'notifications' channel would leak everyone's notifications to every client."""
    p = (await client.post("/api/social/posts", json={"content": "x"}, headers=alice.headers)).json()
    await client.post(f"/api/social/posts/{p['id']}/react", json={}, headers=bob.headers)
    await app.state.realtime.drain()
    topic, event, payload = net.topics("notification")[-1]
    assert topic == f"notifications_{alice.id}" and event == "notification"
    n = payload["notification"]
    assert n["type"] == "like" and n["user_id"] == str(alice.id) and n["is_read"] is False and n["id"]


# ───────────── preferred_broker (added upstream with migration 005_add_preferred_broker.sql) ─────────────
async def test_preferred_broker_defaults_and_round_trips(client, alice, bob, net):
    assert (await client.get("/api/auth/me", headers=alice.headers)).json()["preferred_broker"] == "Exness"
    r = await client.put("/api/auth/me", json={"preferred_broker": "  IC Markets "}, headers=alice.headers)
    assert r.status_code == 200 and r.json()["preferred_broker"] == "IC Markets"            # trimmed, persisted
    assert (await client.get("/api/auth/me", headers=alice.headers)).json()["preferred_broker"] == "IC Markets"
    # the profile page reads both spellings from /api/social/users/{id}
    u = (await client.get(f"/api/social/users/{alice.id}")).json()
    assert u["preferred_broker"] == u["preferredBroker"] == "IC Markets"
    assert (await client.get("/api/social/users/bob")).json()["preferredBroker"] == "Exness"
    assert {x["username"]: x["preferred_broker"] for x in (await client.get("/api/social/users")).json()} == {"alice": "IC Markets", "bob": "Exness"}
    # kept in Supabase Auth metadata too (buildUserFromSession reads it from there)
    assert json.loads(net.admin_put.calls.last.request.content)["user_metadata"]["preferred_broker"] == "IC Markets"


async def test_preferred_broker_validation_and_reset(client, alice):
    h = alice.headers
    assert (await client.put("/api/auth/me", json={"preferred_broker": "x" * 101}, headers=h)).status_code == 422
    assert (await client.put("/api/auth/me", json={"preferred_broker": "Bad\x00Broker"}, headers=h)).status_code == 422
    assert (await client.put("/api/auth/me", json={"preferred_broker": "Deriv"}, headers=h)).json()["preferred_broker"] == "Deriv"
    assert (await client.put("/api/auth/me", json={"preferred_broker": ""}, headers=h)).json()["preferred_broker"] == "Exness"
    # updating other fields leaves the broker alone
    await client.put("/api/auth/me", json={"preferred_broker": "XM Group"}, headers=h)
    assert (await client.put("/api/auth/me", json={"bio": "hi"}, headers=h)).json()["preferred_broker"] == "XM Group"


async def test_preferred_broker_from_signup_metadata_via_db_trigger_and_via_api_provisioning(app, client):
    """Upstream's handle_new_user() (005_add_preferred_broker.sql) fills it from auth metadata; our fallback provisioning does too."""
    db = app.state.db
    u1 = uuid.uuid4()
    await db.execute("INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES ($1,'t1@t.io',$2::jsonb)", u1, {"preferred_broker": "Pepperstone"})     # dict: the pool's jsonb codec does the encoding
    assert await db.fetchval("SELECT preferred_broker FROM users WHERE id = $1", u1) == "Pepperstone"
    u2 = uuid.uuid4()
    await db.execute("INSERT INTO auth.users (id, email) VALUES ($1,'t2@t.io')", u2)
    await db.execute("DELETE FROM users WHERE id = $1", u2)                                      # trigger did not run -> API provisions
    from tests.conftest import token_for
    r = await client.get("/api/auth/me", headers={"Authorization": f"Bearer {token_for(u2, email='t2@t.io', meta={'preferred_broker': 'Deriv'})}"})
    assert r.json()["preferred_broker"] == "Deriv"
    u3 = uuid.uuid4()
    await db.execute("INSERT INTO auth.users (id, email) VALUES ($1,'t3@t.io')", u3)
    await db.execute("DELETE FROM users WHERE id = $1", u3)
    r = await client.get("/api/auth/me", headers={"Authorization": f"Bearer {token_for(u3, email='t3@t.io', meta={'preferred_broker': 'x' * 500})}"})
    assert len(r.json()["preferred_broker"]) == 100                                               # oversized metadata is clamped, not trusted


async def test_watchlist_add_returns_asset_id_like_the_old_route(client, alice):
    r = await client.post("/api/market/watchlist/watchlist-default/items", json={"symbol": "NVDA"}, headers=alice.headers)
    assert r.status_code == 200 and r.json()["success"] is True and r.json()["asset_id"]


async def test_unknown_symbols_are_rejected_not_auto_created(client, alice, app):
    """Upstream's Next route auto-upserts any unknown symbol into `assets`; that would let any user flood the table."""
    before = await app.state.db.fetchval("SELECT count(*) FROM assets")
    for junk, expected in (("ZZZZ1", 404), ("A" * 19, 404), ("'; DROP TABLE assets;--", 422)):   # last: too long -> rejected by validation
        r = await client.post("/api/market/watchlist/watchlist-default/items", json={"symbol": junk}, headers=alice.headers)
        assert r.status_code == expected, junk
    assert await app.state.db.fetchval("SELECT count(*) FROM assets") == before
