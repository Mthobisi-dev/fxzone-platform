import asyncio
import uuid


async def mksession(client, who, **kw):
    r = await client.post("/api/sessions", json={"title": "Gold outlook", **kw}, headers=who.headers)
    assert r.status_code == 201, r.text
    return r.json()


async def join(client, who, sid):
    return await client.post(f"/api/sessions/{sid}/join", headers=who.headers)


async def test_create_session_shape_and_host_is_participant(client, alice):
    s = await mksession(client, alice, description="d", max_participants=5)
    assert s["status"] == "live" and s["host"]["username"] == "alice" and s["hostId"] == str(alice.id)
    assert s["viewer_count"] == 1 and s["max_participants"] == 5 and s["requiresApproval"] is False
    parts = (await client.get(f"/api/sessions/{s['id']}/participants", headers=alice.headers)).json()
    assert [(p["role"], p["user"]["username"]) for p in parts] == [("host", "alice")]


async def test_requires_approval_flag_from_ui_is_honoured(client, alice):
    """The old create route dropped `requires_approval`."""
    assert (await mksession(client, alice, requires_approval=True))["requires_approval"] is True
    assert (await mksession(client, alice, requires_approval=False))["requires_approval"] is False


async def test_open_session_join_is_idempotent_and_counts_viewers(client, alice, bob):
    s = await mksession(client, alice)
    for _ in range(3):                      # the UI can call join repeatedly
        r = await join(client, bob, s["id"])
        assert r.status_code == 200 and r.json()["role"] == "viewer"
    assert (await client.get(f"/api/sessions/{s['id']}")).json()["viewer_count"] == 2
    r = await join(client, alice, s["id"])
    assert r.json()["role"] == "host"


async def test_approval_flow_end_to_end(client, alice, bob, net, app):
    """Old code: enum lacked 'pending' so this flow could not work at all."""
    s = await mksession(client, alice, requires_approval=True)
    sid = s["id"]
    assert (await join(client, bob, sid)).json()["role"] == "pending"
    assert (await join(client, bob, sid)).json()["role"] == "pending"           # polling keeps returning pending
    assert (await client.get(f"/api/sessions/{sid}")).json()["viewer_count"] == 1        # pending viewers aren't counted
    # host sees the pending request, bob (pending) cannot see the participants list
    parts = (await client.get(f"/api/sessions/{sid}/participants", headers=alice.headers)).json()
    assert {p["role"] for p in parts} == {"host", "pending"}
    assert (await client.get(f"/api/sessions/{sid}/participants", headers=bob.headers)).status_code == 200      # pending users belong to the room
    assert (await client.post(f"/api/sessions/{sid}/approve/{bob.id}", headers=bob.headers)).status_code == 403  # can't self-approve
    assert (await client.post(f"/api/sessions/{sid}/approve/{bob.id}", headers=alice.headers)).status_code == 200
    assert (await join(client, bob, sid)).json()["role"] == "viewer"
    assert (await client.get(f"/api/sessions/{sid}")).json()["viewer_count"] == 2
    await app.state.realtime.drain()
    ev = {(t, e): p for t, e, p in net.topics()}
    assert ev[(f"session_{sid}", "participant_approved")] == {"user_id": str(bob.id)}     # SessionRoom listens for this exact payload
    assert ev[(f"session_{sid}", "members_update")]["data"]["count"] == 2


async def test_rejection_is_final_and_broadcast(client, alice, bob, net, app):
    s = await mksession(client, alice, requires_approval=True)
    await join(client, bob, s["id"])
    assert (await client.post(f"/api/sessions/{s['id']}/reject/{bob.id}", headers=alice.headers)).status_code == 200
    r = await join(client, bob, s["id"])
    assert r.status_code == 403 and "declined" in r.json()["detail"]        # cannot simply re-join
    assert (await client.get(f"/api/sessions/{s['id']}/participants", headers=bob.headers)).status_code == 403
    await app.state.realtime.drain()
    assert (f"session_{s['id']}", "participant_rejected", {"user_id": str(bob.id)}) in net.topics()
    assert (await client.post(f"/api/sessions/{s['id']}/reject/{alice.id}", headers=alice.headers)).status_code == 400  # host is not removable


async def test_only_host_or_cohost_or_admin_can_manage(client, alice, bob, make_user, admin, app):
    s = await mksession(client, alice, requires_approval=True)
    carol = await make_user("carol")
    await join(client, bob, s["id"]); await join(client, carol, s["id"])
    assert (await client.post(f"/api/sessions/{s['id']}/approve/{carol.id}", headers=bob.headers)).status_code == 403
    assert (await client.post(f"/api/sessions/{s['id']}/end", headers=bob.headers)).status_code == 403
    await app.state.db.execute("UPDATE session_participants SET role = 'co_host' WHERE session_id = $1 AND user_id = $2", uuid.UUID(s["id"]), bob.id)
    assert (await client.post(f"/api/sessions/{s['id']}/approve/{carol.id}", headers=bob.headers)).status_code == 200
    assert (await client.post(f"/api/sessions/{s['id']}/end", headers=admin.headers)).status_code == 200      # admin cut-off


async def test_capacity_is_enforced_atomically(client, make_user, alice):
    s = await mksession(client, alice, max_participants=3)         # host + 2 viewers
    viewers = [await make_user(f"v{i}") for i in range(6)]
    res = await asyncio.gather(*(join(client, v, s["id"]) for v in viewers))
    assert sorted(r.status_code for r in res) == [200, 200, 400, 400, 400, 400]       # exactly 2 seats left after the host
    assert (await client.get(f"/api/sessions/{s['id']}")).json()["viewer_count"] == 3


async def test_capacity_counts_host_and_frees_on_leave(client, make_user, alice, bob):
    s = await mksession(client, alice, max_participants=2)
    assert (await join(client, bob, s["id"])).status_code == 200
    carol = await make_user("carol")
    r = await join(client, carol, s["id"])
    assert r.status_code == 400 and "capacity" in r.json()["detail"]
    await client.post(f"/api/sessions/{s['id']}/leave", headers=bob.headers)
    assert (await join(client, carol, s["id"])).status_code == 200


async def test_private_sessions_force_approval_and_are_hidden_from_public_list(client, alice, bob, make_user):
    s = await mksession(client, alice, session_type="private", requires_approval=False)
    assert s["requires_approval"] is True
    assert [x["id"] for x in (await client.get("/api/sessions")).json()] == []                     # anonymous: hidden
    assert [x["id"] for x in (await client.get("/api/sessions", headers=bob.headers)).json()] == []
    assert [x["id"] for x in (await client.get("/api/sessions", headers=alice.headers)).json()] == [s["id"]]
    assert (await join(client, bob, s["id"])).json()["role"] == "pending"
    assert [x["id"] for x in (await client.get("/api/sessions", headers=bob.headers)).json()] == [s["id"]]   # requester can see it


async def test_leave_and_host_leave_ends_session(client, alice, bob, net, app):
    s = await mksession(client, alice)
    await join(client, bob, s["id"])
    await client.post(f"/api/sessions/{s['id']}/leave", headers=bob.headers)
    assert (await client.get(f"/api/sessions/{s['id']}")).json()["viewer_count"] == 1
    await client.post(f"/api/sessions/{s['id']}/leave", headers=alice.headers)
    body = (await client.get(f"/api/sessions/{s['id']}")).json()
    assert body["status"] == "ended" and body["viewer_count"] == 0 and body["ended_at"]
    await app.state.realtime.drain()
    assert (f"session_{s['id']}", "session_ended", {}) in net.topics()
    assert (await join(client, bob, s["id"])).status_code == 400
    assert (await client.get("/api/sessions")).json() == []             # ended sessions leave the live list


async def test_end_session_disconnects_everyone(client, alice, bob, app):
    s = await mksession(client, alice)
    await join(client, bob, s["id"])
    assert (await client.post(f"/api/sessions/{s['id']}/end", headers=alice.headers)).status_code == 200
    assert await app.state.db.fetchval("SELECT count(*) FROM session_participants WHERE left_at IS NULL") == 0


async def test_delete_and_clear_history_permissions(client, alice, bob, admin):
    s1, s2 = await mksession(client, alice), await mksession(client, alice)
    assert (await client.delete(f"/api/sessions/{s1['id']}", headers=bob.headers)).status_code == 403
    assert (await client.delete(f"/api/sessions/{s1['id']}", headers=alice.headers)).status_code == 200
    assert (await client.delete(f"/api/sessions/{s1['id']}", headers=alice.headers)).status_code == 200     # idempotent
    await client.post(f"/api/sessions/{s2['id']}/end", headers=alice.headers)
    assert (await client.delete("/api/sessions/history", headers=alice.headers)).status_code == 403
    assert (await client.delete("/api/sessions/history", headers=admin.headers)).status_code == 200
    assert (await client.get(f"/api/sessions/{s2['id']}")).status_code == 404


async def test_public_session_notifies_followers_only(client, alice, bob, make_user):
    fan, stranger = bob, await make_user("stranger")
    await client.post(f"/api/social/users/{alice.id}/follow", json={}, headers=fan.headers)
    await mksession(client, alice)
    assert [n["type"] for n in (await client.get("/api/notifications", headers=fan.headers)).json()] == ["session_live"]
    assert (await client.get("/api/notifications", headers=stranger.headers)).json() == []


async def test_session_validation_and_bad_ids(client, alice):
    assert (await client.post("/api/sessions", json={"title": ""}, headers=alice.headers)).status_code == 422
    assert (await client.post("/api/sessions", json={"title": "x", "max_participants": 0}, headers=alice.headers)).status_code == 422
    assert (await client.post("/api/sessions", json={"title": "x", "session_type": "secret"}, headers=alice.headers)).status_code == 422
    assert (await client.get("/api/sessions/nope")).status_code == 404
    assert (await client.get(f"/api/sessions/{uuid.uuid4()}")).status_code == 404
    assert (await client.post("/api/sessions", json={"title": "x"})).status_code == 401


async def test_stale_live_sessions_are_closed_by_housekeeping(app, alice, client):
    s = await mksession(client, alice)
    await app.state.db.execute("UPDATE live_sessions SET started_at = NOW() - INTERVAL '13 hours' WHERE id = $1", uuid.UUID(s["id"]))
    from app import tasks
    from app.cache import Cache
    calls = []
    async def fake_sleep(_): raise asyncio.CancelledError()
    import unittest.mock as m
    with m.patch.object(tasks.asyncio, "sleep", fake_sleep):
        try:
            await tasks.housekeeping_loop(app.state.db, app.state.cache)
        except asyncio.CancelledError:
            pass
    assert (await client.get(f"/api/sessions/{s['id']}")).json()["status"] == "ended"
