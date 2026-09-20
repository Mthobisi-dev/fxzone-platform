import asyncio
import uuid

from tests.conftest import Who


async def dm(client, a, b):
    r = await client.post("/api/chat/conversations", json={"participant_ids": [str(b.id)], "is_group": False}, headers=a.headers)
    assert r.status_code in (200, 201), r.text
    return r


async def test_dm_create_returns_member_objects_and_dedupes(client, alice, bob):
    r1 = await dm(client, alice, bob)
    assert r1.status_code == 201
    c = r1.json()
    assert c["is_group"] is False and {m["username"] for m in c["members"]} == {"alice", "bob"}
    assert all(isinstance(m, dict) and "id" in m for m in c["members"])          # old POST returned bare ids -> UI broke
    r2 = await dm(client, bob, alice)                                             # reverse direction -> same conversation
    assert r2.status_code == 200 and r2.json()["id"] == c["id"]


async def test_concurrent_dm_creation_makes_exactly_one_conversation(client, alice, bob, app):
    res = await asyncio.gather(*[dm(client, alice if i % 2 else bob, bob if i % 2 else alice) for i in range(8)])
    assert len({r.json()["id"] for r in res}) == 1
    assert await app.state.db.fetchval("SELECT count(*) FROM conversations") == 1


async def test_create_by_username_supported(client, alice, bob):
    r = await client.post("/api/chat/conversations", json={"username": "@BOB", "is_group": False}, headers=alice.headers)
    assert r.status_code == 201 and {m["username"] for m in r.json()["members"]} == {"alice", "bob"}
    r = await client.post("/api/chat/conversations", json={"username": "ghost"}, headers=alice.headers)
    assert r.status_code == 404


async def test_create_validation(client, alice, bob, make_user):
    h = alice.headers
    assert (await client.post("/api/chat/conversations", json={"participant_ids": []}, headers=h)).status_code == 400
    assert (await client.post("/api/chat/conversations", json={"participant_ids": [str(alice.id)]}, headers=h)).status_code == 400   # self only
    assert (await client.post("/api/chat/conversations", json={"participant_ids": [str(uuid.uuid4())]}, headers=h)).status_code == 404
    carol = await make_user("carol")
    r = await client.post("/api/chat/conversations", json={"participant_ids": [str(bob.id), str(carol.id)], "is_group": False}, headers=h)
    assert r.status_code == 400                                                    # DMs have exactly one other person
    r = await client.post("/api/chat/conversations", json={"participant_ids": [str(bob.id)], "is_group": True}, headers=h)
    assert r.status_code == 400 and "name" in r.json()["detail"]


async def test_group_lifecycle_and_permissions(client, alice, bob, make_user):
    carol, dave = await make_user("carol"), await make_user("dave")
    g = (await client.post("/api/chat/conversations", json={"name": "Gold Desk", "description": "XAU chat", "is_group": True,
                                                            "participant_ids": [str(bob.id), str(carol.id)]}, headers=alice.headers)).json()
    assert g["name"] == "Gold Desk" and g["description"] == "XAU chat" and len(g["members"]) == 3 and g["creator_id"] == str(alice.id)
    gid = g["id"]
    # only the creator edits settings
    assert (await client.patch(f"/api/chat/conversations/{gid}", json={"name": "hax"}, headers=bob.headers)).status_code == 403
    assert (await client.patch(f"/api/chat/conversations/{gid}", json={"name": "Gold Desk 2"}, headers=alice.headers)).json()["name"] == "Gold Desk 2"
    # any member may add (by username, as the UI's modal does); non-members can't
    r = await client.post(f"/api/chat/conversations/{gid}/members", json={"usernames": ["dave"]}, headers=bob.headers)
    assert r.status_code == 200 and len(r.json()["members"]) == 4
    assert (await client.post(f"/api/chat/conversations/{gid}/members", json={"usernames": ["dave"]}, headers=bob.headers)).status_code == 200  # re-adding is a no-op
    outsider = await make_user("mallory")
    assert (await client.post(f"/api/chat/conversations/{gid}/members", json={"usernames": ["mallory"]}, headers=outsider.headers)).status_code == 403
    # only the creator removes others; anyone can leave
    assert (await client.delete(f"/api/chat/conversations/{gid}/members/{carol.id}", headers=bob.headers)).status_code == 403
    assert (await client.delete(f"/api/chat/conversations/{gid}/members/{carol.id}", headers=alice.headers)).status_code == 200
    assert (await client.delete(f"/api/chat/conversations/{gid}/members/me", headers=bob.headers)).status_code == 200
    assert (await client.get(f"/api/chat/conversations/{gid}", headers=bob.headers)).status_code == 404   # no longer a member


async def test_group_size_cap_and_dm_membership_is_immutable(client, alice, bob, make_user):
    users = [await make_user(f"u{i}") for i in range(50)]
    r = await client.post("/api/chat/conversations", json={"name": "big", "is_group": True, "participant_ids": [str(u.id) for u in users]}, headers=alice.headers)
    assert r.status_code == 400 and "50" in r.json()["detail"]
    c = (await dm(client, alice, bob)).json()
    assert (await client.post(f"/api/chat/conversations/{c['id']}/members", json={"usernames": ["bob"]}, headers=alice.headers)).status_code == 400
    assert (await client.delete(f"/api/chat/conversations/{c['id']}/members/me", headers=alice.headers)).status_code == 400


async def test_last_member_leaving_deletes_group(client, alice, bob, app):
    g = (await client.post("/api/chat/conversations", json={"name": "tmp", "is_group": True, "participant_ids": [str(bob.id)]}, headers=alice.headers)).json()
    await client.delete(f"/api/chat/conversations/{g['id']}/members/me", headers=alice.headers)
    await client.delete(f"/api/chat/conversations/{g['id']}/members/me", headers=bob.headers)
    assert await app.state.db.fetchval("SELECT count(*) FROM conversations") == 0


async def test_messages_send_order_unread_and_read_marker(client, alice, bob, net):
    c = (await dm(client, alice, bob)).json()
    url = f"/api/chat/conversations/{c['id']}/messages"
    for i in range(3):
        r = await client.post(url, json={"content": f"m{i}"}, headers=alice.headers)
        assert r.status_code == 201 and r.json()["sender"]["username"] == "alice"
    convs = (await client.get("/api/chat/conversations", headers=bob.headers)).json()
    assert convs[0]["unread_count"] == 3 and convs[0]["unreadCount"] == 3
    assert convs[0]["last_message"]["content"] == "m2" and convs[0]["lastMessage"]["content"] == "m2"
    assert (await client.get("/api/chat/conversations", headers=alice.headers)).json()[0]["unread_count"] == 0   # own messages aren't unread
    msgs = (await client.get(url, headers=bob.headers)).json()
    assert [m["content"] for m in msgs] == ["m0", "m1", "m2"]                       # oldest -> newest
    assert (await client.get("/api/chat/conversations", headers=bob.headers)).json()[0]["unread_count"] == 0     # fetching marks read


async def test_message_pagination(client, alice, bob):
    c = (await dm(client, alice, bob)).json()
    url = f"/api/chat/conversations/{c['id']}/messages"
    for i in range(7):
        await client.post(url, json={"content": f"m{i}"}, headers=alice.headers)
    page1 = (await client.get(url + "?limit=3", headers=bob.headers)).json()
    assert [m["content"] for m in page1] == ["m4", "m5", "m6"]
    from urllib.parse import quote
    page2 = (await client.get(url + f"?limit=3&before={quote(page1[0]['created_at'])}", headers=bob.headers)).json()
    assert [m["content"] for m in page2] == ["m1", "m2", "m3"]


async def test_non_member_cannot_read_or_write_and_ids_are_validated(client, alice, bob, make_user):
    c = (await dm(client, alice, bob)).json()
    eve = await make_user("eve")
    url = f"/api/chat/conversations/{c['id']}/messages"
    assert (await client.get(url, headers=eve.headers)).status_code == 403
    assert (await client.post(url, json={"content": "psst"}, headers=eve.headers)).status_code == 403
    assert (await client.get(f"/api/chat/conversations/{c['id']}", headers=eve.headers)).status_code == 404
    assert (await client.get("/api/chat/conversations/not-a-uuid/messages", headers=eve.headers)).status_code == 404
    assert (await client.get(url)).status_code == 401       # old route answered 200 [] to anonymous callers


async def test_message_validation(client, alice, bob):
    c = (await dm(client, alice, bob)).json()
    url = f"/api/chat/conversations/{c['id']}/messages"
    assert (await client.post(url, json={"content": "   "}, headers=alice.headers)).status_code == 422
    assert (await client.post(url, json={"content": "x" * 4001}, headers=alice.headers)).status_code == 422
    assert (await client.post(url, json={"content": "x", "message_type": "exec"}, headers=alice.headers)).status_code == 422
    r = await client.post(url, json={"content": "[Voice Note] (url: https://x/y.webm)", "message_type": "text"}, headers=alice.headers)
    assert r.status_code == 201


async def test_new_message_is_broadcast_on_the_topic_the_frontend_subscribes_to(client, alice, bob, net, app):
    c = (await dm(client, alice, bob)).json()
    await client.post(f"/api/chat/conversations/{c['id']}/messages", json={"content": "live!"}, headers=alice.headers)
    await app.state.realtime.drain()
    # frontend: new FxZoneWebSocket(`/ws/chat/${id}`) -> channel `chat_${id}`
    topic, event, payload = net.topics("new_message")[-1]
    assert topic == f"chat_{c['id']}" and event == "new_message"
    # the chat page reads exactly these keys off the payload
    assert payload["content"] == "live!" and payload["conversation_id"] == c["id"] and payload["sender_id"] == str(alice.id)
    assert payload["id"] and payload["created_at"] and payload["sender"]["username"] == "alice"
    sent = net.realtime.calls.last.request
    assert sent.headers["apikey"] == "service-key" and sent.headers["authorization"] == "Bearer service-key"


async def test_broadcast_failure_never_fails_the_request(client, alice, bob, net, app):
    import httpx
    net.realtime.mock(side_effect=httpx.ConnectError("realtime down"))
    c = (await dm(client, alice, bob)).json()
    r = await client.post(f"/api/chat/conversations/{c['id']}/messages", json={"content": "still saved"}, headers=alice.headers)
    assert r.status_code == 201
    await app.state.realtime.drain()
    assert app.state.realtime.failed >= 1
    assert [m["content"] for m in (await client.get(f"/api/chat/conversations/{c['id']}/messages", headers=bob.headers)).json()] == ["still saved"]
