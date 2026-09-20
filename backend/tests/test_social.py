import asyncio
import uuid

import pytest

PNG = b"\x89PNG\r\n\x1a\n" + b"\x00" * 64


async def mkpost(client, who, content="hello", **kw):
    r = await client.post("/api/social/posts", json={"content": content, **kw}, headers=who.headers)
    assert r.status_code == 201, r.text
    return r.json()


# ───────────── posts, feed, tags ─────────────
async def test_create_post_shape_matches_frontend_contract(client, alice):
    p = await mkpost(client, alice, "BTC looks strong $ETHUSD too", caption="cap", asset_tags=["btcusd", "$EURUSD", "NOPE"],
                     show_likes_count=False, allow_reshare=False)
    assert p["user"]["username"] == "alice" and p["user_id"] == str(alice.id) and p["caption"] == "cap"
    assert p["asset_tags"] == ["BTCUSD", "ETHUSD", "EURUSD"]          # explicit + cashtag, unknown dropped, normalised
    assert p["show_likes_count"] is False and p["allow_reshare"] is False and p["allow_save"] is True
    assert p["likes_count"] == p["comments_count"] == p["reposts_count"] == 0
    assert p["is_liked_by_user"] is False and p["is_story"] is False


async def test_post_validation(client, alice):
    h = alice.headers
    assert (await client.post("/api/social/posts", json={}, headers=h)).status_code == 422
    assert (await client.post("/api/social/posts", json={"content": "x", "image_url": "javascript:alert(1)"}, headers=h)).status_code == 422
    assert (await client.post("/api/social/posts", json={"content": "x", "image_url": "data:image/png;base64,AAAA"}, headers=h)).status_code == 422
    assert (await client.post("/api/social/posts", json={"content": "x" * 5001}, headers=h)).status_code == 422
    assert (await client.post("/api/social/posts", json={"content": "x"})).status_code == 401
    # media-only post gets the placeholder text the UI already uses
    r = await client.post("/api/social/posts", json={"image_url": "https://cdn.example.com/a.png"}, headers=h)
    assert r.status_code == 201 and r.json()["content"] == "📊 Shared media attachment"


async def test_feed_pagination_order_and_excludes_stories(client, alice):
    for i in range(5):
        await mkpost(client, alice, f"p{i}")
    await client.post("/api/social/stories", json={"content": "story"}, headers=alice.headers)
    r = await client.get("/api/social/feed?limit=2&offset=0")
    assert [p["content"] for p in r.json()] == ["p4", "p3"]
    r = await client.get("/api/social/feed?limit=10&offset=2")
    assert [p["content"] for p in r.json()] == ["p2", "p1", "p0"]        # no story, no duplicates across pages


async def test_feed_flags_reflect_viewer(client, alice, bob):
    p = await mkpost(client, alice, "hi")
    await client.post(f"/api/social/posts/{p['id']}/react", json={"reaction_type": "like"}, headers=bob.headers)
    await client.post(f"/api/social/posts/{p['id']}/bookmark", json={}, headers=bob.headers)
    as_bob = (await client.get("/api/social/feed", headers=bob.headers)).json()[0]
    as_alice = (await client.get("/api/social/feed", headers=alice.headers)).json()[0]
    anon = (await client.get("/api/social/feed")).json()[0]
    assert as_bob["is_liked_by_user"] and as_bob["is_bookmarked_by_user"] and as_bob["likes_count"] == 1
    assert not as_alice["is_liked_by_user"] and not anon["is_liked_by_user"] and anon["likes_count"] == 1  # persists across reloads


# ───────────── reactions / counters ─────────────
async def test_like_toggle_counts_and_notifies_once(client, alice, bob, app):
    p = await mkpost(client, alice, "hi")
    url = f"/api/social/posts/{p['id']}/react"
    r = await client.post(url, json={"reaction_type": "like"}, headers=bob.headers)
    assert r.json() == {"active": True, "likes_count": 1, "reaction_type": "like"}
    r = await client.post(url, json={"reaction_type": "like"}, headers=bob.headers)
    assert r.json()["active"] is False and r.json()["likes_count"] == 0
    for _ in range(2):  # like / unlike / like again: still ONE like notification within the dedupe window
        await client.post(url, json={"reaction_type": "like"}, headers=bob.headers)
        await client.post(url, json={"reaction_type": "like"}, headers=bob.headers)
    notes = (await client.get("/api/notifications", headers=alice.headers)).json()
    assert [n["type"] for n in notes] == ["like"] and notes[0]["data"]["actor_username"] == "bob"


async def test_self_like_creates_no_notification(client, alice):
    p = await mkpost(client, alice, "mine")
    await client.post(f"/api/social/posts/{p['id']}/react", json={}, headers=alice.headers)
    assert (await client.get("/api/notifications", headers=alice.headers)).json() == []


async def test_concurrent_likes_from_many_users_are_counted_exactly(client, make_user):
    author = await make_user("author")
    p = await mkpost(client, author, "popular")
    fans = [await make_user(f"fan{i}") for i in range(12)]
    res = await asyncio.gather(*(client.post(f"/api/social/posts/{p['id']}/react", json={}, headers=f.headers) for f in fans))
    assert all(r.status_code == 200 for r in res)
    assert (await client.get(f"/api/social/posts/{p['id']}")).json()["likes_count"] == 12   # old read-modify-write lost updates


async def test_double_click_race_same_user_never_goes_negative_or_duplicates(client, alice, bob, app):
    p = await mkpost(client, alice, "x")
    await asyncio.gather(*(client.post(f"/api/social/posts/{p['id']}/react", json={}, headers=bob.headers) for _ in range(8)))
    rows = await app.state.db.fetchval("SELECT count(*) FROM reactions WHERE post_id = $1", uuid.UUID(p["id"]))
    likes = (await client.get(f"/api/social/posts/{p['id']}")).json()["likes_count"]
    assert rows in (0, 1) and likes == rows


async def test_react_on_missing_post_404(client, alice):
    assert (await client.post(f"/api/social/posts/{uuid.uuid4()}/react", json={}, headers=alice.headers)).status_code == 404
    assert (await client.post("/api/social/posts/not-a-uuid/react", json={}, headers=alice.headers)).status_code == 404


# ───────────── comments ─────────────
async def test_comments_threads_counts_and_delete_permissions(client, alice, bob, make_user, admin):
    p = await mkpost(client, alice, "post")
    c1 = (await client.post(f"/api/social/posts/{p['id']}/comments", json={"content": "first"}, headers=bob.headers)).json()
    assert c1["user"]["username"] == "bob" and c1["parent_id"] is None
    reply = (await client.post(f"/api/social/posts/{p['id']}/comments", json={"content": "re", "parent_id": c1["id"]}, headers=alice.headers)).json()
    assert reply["parent_id"] == c1["id"]
    listed = (await client.get(f"/api/social/posts/{p['id']}/comments")).json()
    assert [c["content"] for c in listed] == ["first", "re"]                     # replies are visible (old route hid them)
    assert (await client.get(f"/api/social/posts/{p['id']}")).json()["comments_count"] == 2
    # someone else can't delete; the post owner can delete another's comment; deleting parent cascades replies
    carol = await make_user("carol")
    assert (await client.delete(f"/api/social/comments/{c1['id']}", headers=carol.headers)).status_code == 403
    assert (await client.delete(f"/api/social/comments/{c1['id']}", headers=alice.headers)).status_code == 200
    assert (await client.get(f"/api/social/posts/{p['id']}")).json()["comments_count"] == 0
    assert (await client.delete(f"/api/social/comments/{c1['id']}", headers=alice.headers)).status_code == 200   # idempotent


async def test_comment_validation(client, alice, bob):
    p = await mkpost(client, alice, "post")
    other = await mkpost(client, bob, "other")
    url = f"/api/social/posts/{p['id']}/comments"
    assert (await client.post(url, json={"content": ""}, headers=bob.headers)).status_code == 422
    assert (await client.post(url, json={"content": "x" * 2001}, headers=bob.headers)).status_code == 422
    foreign_parent = (await client.post(f"/api/social/posts/{other['id']}/comments", json={"content": "c"}, headers=alice.headers)).json()
    assert (await client.post(url, json={"content": "hi", "parent_id": foreign_parent["id"]}, headers=bob.headers)).status_code == 400
    assert (await client.post(f"/api/social/posts/{uuid.uuid4()}/comments", json={"content": "hi"}, headers=bob.headers)).status_code == 404


async def test_comment_notifications(client, alice, bob):
    p = await mkpost(client, alice, "post")
    c = (await client.post(f"/api/social/posts/{p['id']}/comments", json={"content": "nice"}, headers=bob.headers)).json()
    await client.post(f"/api/social/posts/{p['id']}/comments", json={"content": "thx", "parent_id": c["id"]}, headers=alice.headers)
    a = (await client.get("/api/notifications", headers=alice.headers)).json()
    b = (await client.get("/api/notifications", headers=bob.headers)).json()
    assert [n["type"] for n in a] == ["comment"] and "commented" in a[0]["title"]
    assert [n["type"] for n in b] == ["comment"] and "replied" in b[0]["title"]


# ───────────── bookmarks / reposts / pins ─────────────
async def test_bookmark_and_saved_list(client, alice, bob):
    """Old routes wrote to a non-existent `saved_posts` table, so saving never worked."""
    p = await mkpost(client, alice, "save me")
    url = f"/api/social/posts/{p['id']}/bookmark"
    assert (await client.post(url, json={}, headers=bob.headers)).json() == {"is_bookmarked": True}
    saved = (await client.get("/api/social/posts/saved", headers=bob.headers)).json()
    assert [s["id"] for s in saved] == [p["id"]] and saved[0]["is_bookmarked_by_user"] is True
    assert (await client.post(url, json={}, headers=bob.headers)).json() == {"is_bookmarked": False}
    assert (await client.get("/api/social/posts/saved", headers=bob.headers)).json() == []
    assert (await client.get("/api/social/posts/saved")).status_code == 401


async def test_allow_save_and_allow_reshare_are_enforced_server_side(client, alice, bob):
    p = await mkpost(client, alice, "locked", allow_save=False, allow_reshare=False)
    assert (await client.post(f"/api/social/posts/{p['id']}/bookmark", json={}, headers=bob.headers)).status_code == 403
    assert (await client.post(f"/api/social/posts/{p['id']}/repost", json={}, headers=bob.headers)).status_code == 403
    assert (await client.post(f"/api/social/posts/{p['id']}/bookmark", json={}, headers=alice.headers)).status_code == 200  # owner may


async def test_repost_toggle_is_per_user_not_a_blind_increment(client, alice, bob):
    p = await mkpost(client, alice, "rp")
    url = f"/api/social/posts/{p['id']}/repost"
    assert (await client.post(url, json={}, headers=bob.headers)).json() == {"reposts_count": 1, "is_reposted": True}
    assert (await client.post(url, json={}, headers=alice.headers)).json()["reposts_count"] == 2
    assert (await client.post(url, json={}, headers=bob.headers)).json() == {"reposts_count": 1, "is_reposted": False}
    story = (await client.post("/api/social/stories", json={"content": "s"}, headers=alice.headers)).json()
    assert (await client.post(f"/api/social/posts/{story['id']}/repost", json={}, headers=bob.headers)).status_code == 400


async def test_pin_only_by_owner_and_max_three(client, alice, bob):
    """Old route let ANY signed-in user pin ANY post."""
    posts = [await mkpost(client, alice, f"p{i}") for i in range(4)]
    assert (await client.post(f"/api/social/posts/{posts[0]['id']}/pin", json={}, headers=bob.headers)).status_code == 403
    for p in posts[:3]:
        assert (await client.post(f"/api/social/posts/{p['id']}/pin", json={}, headers=alice.headers)).json()["is_pinned"] is True
    assert (await client.post(f"/api/social/posts/{posts[3]['id']}/pin", json={}, headers=alice.headers)).status_code == 400
    assert (await client.post(f"/api/social/posts/{posts[0]['id']}/pin", json={}, headers=alice.headers)).json()["is_pinned"] is False
    profile_posts = (await client.get(f"/api/social/users/{alice.id}/posts")).json()
    assert [p["is_pinned"] for p in profile_posts][:2] == [True, True]      # pinned first on profile


# ───────────── delete ─────────────
async def test_delete_post_permissions_and_cascade(client, alice, bob, admin, app):
    p = await mkpost(client, alice, "victim")
    await client.post(f"/api/social/posts/{p['id']}/comments", json={"content": "c"}, headers=bob.headers)
    await client.post(f"/api/social/posts/{p['id']}/react", json={}, headers=bob.headers)
    assert (await client.delete(f"/api/social/posts/{p['id']}", headers=bob.headers)).status_code == 403
    assert (await client.delete(f"/api/social/posts/{p['id']}", headers=alice.headers)).status_code == 200
    assert (await client.get(f"/api/social/posts/{p['id']}")).status_code == 404
    assert await app.state.db.fetchval("SELECT count(*) FROM comments") == 0 == await app.state.db.fetchval("SELECT count(*) FROM reactions")
    p2 = await mkpost(client, alice, "admin-removable")
    assert (await client.delete(f"/api/social/posts/{p2['id']}", headers=admin.headers)).status_code == 200


async def test_delete_is_idempotent_and_tolerates_client_temp_ids(client, alice):
    assert (await client.delete(f"/api/social/posts/{uuid.uuid4()}", headers=alice.headers)).status_code == 200
    assert (await client.delete("/api/social/posts/temp-12345", headers=alice.headers)).status_code == 200


async def test_admin_email_literal_grants_nothing(client, make_user):
    """The old delete route granted admin to two hard-coded emails. Only the DB role counts now."""
    sneaky = await make_user("sneaky")  # email sneaky@t.io; even a token claiming the old admin email is just a trader
    victim = await make_user("victim")
    p = await mkpost(client, victim, "keep")
    from tests.conftest import token_for
    t = token_for(sneaky.id, email="mthobisimzimela031@gmail.com", meta={"role": "admin"})
    assert (await client.delete(f"/api/social/posts/{p['id']}", headers={"Authorization": f"Bearer {t}"})).status_code == 403


async def test_purge_all_only_removes_callers_own_posts(client, alice, bob):
    await mkpost(client, alice, "a1"); await mkpost(client, alice, "a2"); keep = await mkpost(client, bob, "b1")
    r = await client.delete("/api/social/posts/purge-all", headers=alice.headers)
    assert r.status_code == 200 and r.json()["deleted"] == 2
    assert [p["id"] for p in (await client.get("/api/social/feed")).json()] == [keep["id"]]


# ───────────── stories / trending / experts ─────────────
async def test_story_expiry_and_cleanup(client, alice, app):
    s = (await client.post("/api/social/stories", json={"content": "live setup", "image_url": "https://cdn.example.com/s.png"}, headers=alice.headers)).json()
    assert s["is_story"] is True and s["expires_at"] is not None
    assert [x["id"] for x in (await client.get("/api/social/stories")).json()] == [s["id"]]
    await app.state.db.execute("UPDATE posts SET expires_at = NOW() - INTERVAL '1 minute' WHERE id = $1", uuid.UUID(s["id"]))
    assert (await client.get("/api/social/stories")).json() == []            # expired stories vanish immediately


async def test_trending_symbols_are_computed_from_tags_not_substrings(client, alice, bob):
    await mkpost(client, alice, "going long $BTCUSD")
    await mkpost(client, bob, "still bullish", asset_tags=["BTCUSD", "XAUUSD"])
    await mkpost(client, bob, "AAPLE pie recipe")   # old code counted 'AAPL' inside 'AAPLE'
    t = (await client.get("/api/social/trending-symbols")).json()
    assert t[0] == {"symbol": "BTCUSD", "posts": 2} and {"symbol": "XAUUSD", "posts": 1} in t
    assert all(x["symbol"] != "AAPL" for x in t)


async def test_featured_experts_have_no_fabricated_stats(client, alice, make_user):
    await make_user("edu", role="verified_educator")
    ex = (await client.get("/api/social/featured-experts")).json()
    assert ex[0]["username"] == "edu"
    assert "win_rate" not in ex[0] and "total_profit_pct" not in ex[0]


# ───────────── users / follow ─────────────
async def test_user_list_never_exposes_email(client, alice, bob):
    """The old public route selected `email` for every user."""
    users = (await client.get("/api/social/users")).json()
    assert {u["username"] for u in users} == {"alice", "bob"}
    assert all("email" not in u for u in users)
    assert "email" not in (await client.get(f"/api/social/users/{alice.id}")).json()


async def test_user_search_and_wildcards_are_literal(client, make_user):
    await make_user("trader_one"); await make_user("traderXone"); await make_user("100%_real")
    names = lambda r: {u["username"] for u in r.json()}
    assert names(await client.get("/api/social/users?q=trader_one")) == {"trader_one"}   # '_' is not a wildcard
    assert names(await client.get("/api/social/users?q=%25")) == {"100%_real"}           # '%' is not a wildcard
    assert names(await client.get("/api/social/users?q=TRADERX")) == {"traderXone"}      # case-insensitive


async def test_get_user_by_id_or_username_and_404_instead_of_fake_profile(client, alice):
    a = (await client.get(f"/api/social/users/{alice.id}")).json()
    b = (await client.get("/api/social/users/ALICE")).json()
    assert a["id"] == b["id"] == str(alice.id) and a["displayName"] == "Alice" and a["followersCount"] == 0
    assert (await client.get(f"/api/social/users/{uuid.uuid4()}")).status_code == 404
    assert (await client.get("/api/social/users/ghost")).status_code == 404


async def test_follow_toggle_counts_flags_and_notification(client, alice, bob):
    r = await client.post(f"/api/social/users/{bob.id}/follow", json={}, headers=alice.headers)
    assert r.json() == {"is_following": True, "followers_count": 1}
    listed = {u["username"]: u for u in (await client.get("/api/social/users", headers=alice.headers)).json()}
    assert listed["bob"]["is_following"] is True and listed["bob"]["is_mutual"] is False
    prof = (await client.get(f"/api/social/users/{alice.id}", headers=alice.headers)).json()
    assert prof["following_count"] == 1
    assert [n["type"] for n in (await client.get("/api/notifications", headers=bob.headers)).json()] == ["follow"]
    r = await client.post(f"/api/social/users/{bob.id}/follow", json={}, headers=alice.headers)
    assert r.json() == {"is_following": False, "followers_count": 0}


async def test_follow_rules(client, alice):
    assert (await client.post(f"/api/social/users/{alice.id}/follow", json={}, headers=alice.headers)).status_code == 400
    assert (await client.post(f"/api/social/users/{uuid.uuid4()}/follow", json={}, headers=alice.headers)).status_code == 404
    assert (await client.post("/api/social/users/nope/follow", json={}, headers=alice.headers)).status_code == 404


async def test_follow_via_body_is_idempotent_and_manual_user_creation_is_refused(client, alice, bob):
    for _ in range(2):
        assert (await client.post("/api/social/users", json={"following_id": str(bob.id)}, headers=alice.headers)).status_code == 201
    assert (await client.get(f"/api/social/users/{bob.id}")).json()["followers_count"] == 1
    r = await client.post("/api/social/users", json={"username": "fake_trader"}, headers=alice.headers)
    assert r.status_code == 400 and "register" in r.json()["detail"]


async def test_concurrent_mutual_follows_do_not_deadlock(client, alice, bob):
    res = await asyncio.gather(*[client.post(f"/api/social/users/{t.id}/follow", json={"x": i}, headers=f.headers)
                                 for i in range(1) for f, t in ((alice, bob), (bob, alice))])
    assert all(r.status_code == 200 for r in res)
    assert (await client.get(f"/api/social/users/{alice.id}")).json()["followers_count"] == 1


# ───────────── uploads ─────────────
async def upload(client, who, name, data, ctype):
    return await client.post("/api/social/posts/upload", files={"file": (name, data, ctype)}, headers=who.headers)


async def test_upload_accepts_real_png_and_ignores_client_filename(client, alice):
    r = await upload(client, alice, "../../evil.html", PNG, "text/html")
    assert r.status_code == 200
    body = r.json()
    assert body["content_type"] == "image/png" and body["url"].endswith(".png") and f"/{alice.id}/" in body["url"]
    assert "evil" not in body["url"] and ".html" not in body["url"]


@pytest.mark.parametrize("name,data,ctype", [
    ("x.png", b"<svg xmlns='http://www.w3.org/2000/svg' onload='alert(1)'/>", "image/png"),   # svg disguised as png
    ("x.png", b"<html><script>alert(1)</script></html>", "image/png"),
    ("x.jpg", b"MZ\x90\x00this is an exe", "image/jpeg"),
    ("x.png", b"hello world", "image/png"),
])
async def test_upload_rejects_content_that_is_not_an_allowed_media_type(client, alice, name, data, ctype):
    r = await upload(client, alice, name, data, ctype)
    assert r.status_code == 400 and "Unsupported" in r.json()["detail"]


@pytest.mark.parametrize("data,mime", [
    (b"\xff\xd8\xff\xe0" + b"0" * 30, "image/jpeg"), (b"GIF89a" + b"0" * 30, "image/gif"),
    (b"RIFF\x00\x00\x00\x00WEBPVP8 " + b"0" * 20, "image/webp"), (b"%PDF-1.7\n" + b"0" * 30, "application/pdf"),
    (b"\x1a\x45\xdf\xa3" + b"0" * 30, "video/webm"), (b"\x00\x00\x00\x18ftypmp42" + b"0" * 20, "video/mp4"),
    (b"OggS" + b"0" * 30, "audio/ogg"), (b"ID3\x03" + b"0" * 30, "audio/mpeg"),
])
async def test_upload_accepts_each_supported_signature(client, alice, data, mime):
    r = await upload(client, alice, "f.bin", data, "application/octet-stream")
    assert r.status_code == 200 and r.json()["content_type"] == mime


async def test_voice_note_webm_keeps_audio_type(client, alice):
    r = await upload(client, alice, "voice_note.webm", b"\x1a\x45\xdf\xa3" + b"0" * 40, "audio/webm")
    assert r.json()["content_type"] == "audio/webm"


async def test_upload_size_limit_and_empty_and_auth(client, alice, app):
    saved = app.state.settings.max_upload_bytes
    app.state.settings.max_upload_bytes = 1024
    try:
        assert (await upload(client, alice, "big.png", PNG + b"0" * 2000, "image/png")).status_code == 400
    finally:
        app.state.settings.max_upload_bytes = saved
    assert (await upload(client, alice, "e.png", b"", "image/png")).status_code == 400
    assert (await client.post("/api/social/posts/upload", files={"file": ("a.png", PNG, "image/png")})).status_code == 401


async def test_oversized_multipart_is_rejected_before_buffering(client, alice):
    r = await client.post("/api/social/posts/upload", content=b"0" * 10, headers={**alice.headers, "content-length": str(200 * 1024 * 1024),
                                                                                      "content-type": "multipart/form-data; boundary=x"})
    assert r.status_code == 413
