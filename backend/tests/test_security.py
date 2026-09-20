import json
import uuid
from datetime import datetime, timedelta, timezone

import jwt
import pytest
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import ec, rsa

from tests.conftest import SECRET, SUPABASE_URL, token_for


def hdr(t):
    return {"Authorization": f"Bearer {t}"}


async def test_valid_token_returns_profile_and_own_email(client, alice):
    r = await client.get("/api/auth/me", headers=alice.headers)
    assert r.status_code == 200
    assert r.json()["username"] == "alice" and r.json()["email"] == "alice@t.io" and r.json()["role"] == "trader"


@pytest.mark.parametrize("label,kwargs", [
    ("expired", dict(exp_in=-3600)),
    ("wrong secret", dict(secret="another-secret-of-sufficient-length-1234")),
    ("wrong audience", dict(aud="anon")),
    ("wrong issuer", dict(iss="https://evil.example.com/auth/v1")),
])
async def test_bad_tokens_rejected(client, alice, label, kwargs):
    r = await client.get("/api/auth/me", headers=hdr(token_for(alice.id, **kwargs)))
    assert r.status_code == 401, label


async def test_unsigned_alg_none_rejected(client, alice):
    forged = jwt.encode({"sub": str(alice.id), "aud": "authenticated", "iss": f"{SUPABASE_URL}/auth/v1",
                         "exp": datetime.now(timezone.utc) + timedelta(hours=1)}, key=None, algorithm="none")
    r = await client.get("/api/auth/me", headers=hdr(forged))
    assert r.status_code == 401


async def test_missing_sub_or_non_uuid_sub_rejected(client):
    no_sub = jwt.encode({"aud": "authenticated", "iss": f"{SUPABASE_URL}/auth/v1", "exp": datetime.now(timezone.utc) + timedelta(hours=1)},
                        SECRET, algorithm="HS256")
    assert (await client.get("/api/auth/me", headers=hdr(no_sub))).status_code == 401
    assert (await client.get("/api/auth/me", headers=hdr(token_for("not-a-uuid")))).status_code == 401


async def test_malformed_authorization_headers(client):
    for h in ("Bearer", "Basic abc", "Bearer  ", "garbage"):
        assert (await client.get("/api/auth/me", headers={"Authorization": h})).status_code == 401


async def test_present_but_invalid_token_on_public_endpoint_is_401_not_anonymous(client, alice):
    """The client refreshes on 401; silently treating a bad token as anonymous would hide the problem."""
    r = await client.get("/api/social/feed", headers=hdr(token_for(alice.id, exp_in=-10)))
    assert r.status_code == 401
    assert (await client.get("/api/social/feed")).status_code == 200


async def test_role_comes_from_database_not_token_metadata(client, alice, admin):
    # user-controlled metadata claims admin; the DB says trader
    t = token_for(alice.id, meta={"role": "admin"}, extra={"app_metadata": {"role": "admin"}})
    assert (await client.delete("/api/sessions/history", headers=hdr(t))).status_code == 403
    assert (await client.delete("/api/sessions/history", headers=admin.headers)).status_code == 200


async def test_new_supabase_user_is_provisioned_as_trader_even_if_metadata_says_admin(app, client):
    uid = uuid.uuid4()
    await app.state.db.execute("INSERT INTO auth.users (id, email) VALUES ($1, 'newbie@t.io')", uid)
    await app.state.db.execute("DELETE FROM users WHERE id = $1", uid)  # simulate: trigger did not run
    r = await client.get("/api/auth/me", headers=hdr(token_for(uid, email="newbie@t.io", meta={"role": "admin", "username": "Newbie!!"})))
    assert r.status_code == 200 and r.json()["role"] == "trader"
    assert r.json()["username"].startswith("newbie_") and r.json()["email"] == "newbie@t.io"


async def test_token_of_deleted_auth_user_cannot_resurrect_account(client):
    ghost = uuid.uuid4()  # valid signature, but no such identity in auth.users
    r = await client.get("/api/auth/me", headers=hdr(token_for(ghost)))
    assert r.status_code == 401 and "no longer exists" in r.json()["detail"]


async def test_deactivated_account_is_blocked_after_cache_expiry(app, client, alice):
    assert (await client.get("/api/auth/me", headers=alice.headers)).status_code == 200
    await app.state.db.execute("UPDATE users SET is_active = false WHERE id = $1", alice.id)
    await app.state.cache.delete(f"profile:{alice.id}")  # profile cache TTL is 20s; expire it
    r = await client.get("/api/auth/me", headers=alice.headers)
    assert r.status_code == 403 and "deactivated" in r.json()["detail"]


# ── asymmetric (JWKS) verification ─────────────────────────────────────────
def _jwks_for(public_key, kid, alg):
    from jwt.algorithms import ECAlgorithm, RSAAlgorithm
    jwk = json.loads((RSAAlgorithm if alg == "RS256" else ECAlgorithm).to_jwk(public_key))
    jwk.update(kid=kid, alg=alg, use="sig")
    return {"keys": [jwk]}


@pytest.mark.parametrize("alg", ["RS256", "ES256"])
async def test_jwks_asymmetric_tokens(app, client, alice, monkeypatch, alg):
    key = rsa.generate_private_key(public_exponent=65537, key_size=2048) if alg == "RS256" else ec.generate_private_key(ec.SECP256R1())
    kid = f"k-{alg}"
    jwks = _jwks_for(key.public_key(), kid, alg)
    monkeypatch.setattr(app.state.verifier._jwks, "fetch_data", lambda: jwks)
    pem = key.private_bytes(serialization.Encoding.PEM, serialization.PrivateFormat.PKCS8, serialization.NoEncryption())
    good = jwt.encode({"sub": str(alice.id), "aud": "authenticated", "iss": f"{SUPABASE_URL}/auth/v1",
                       "exp": datetime.now(timezone.utc) + timedelta(hours=1)}, pem, algorithm=alg, headers={"kid": kid})
    assert (await client.get("/api/auth/me", headers=hdr(good))).status_code == 200
    # signed by a different key with the same kid -> must fail
    other = rsa.generate_private_key(public_exponent=65537, key_size=2048) if alg == "RS256" else ec.generate_private_key(ec.SECP256R1())
    opem = other.private_bytes(serialization.Encoding.PEM, serialization.PrivateFormat.PKCS8, serialization.NoEncryption())
    forged = jwt.encode({"sub": str(alice.id), "aud": "authenticated", "iss": f"{SUPABASE_URL}/auth/v1",
                         "exp": datetime.now(timezone.utc) + timedelta(hours=1)}, opem, algorithm=alg, headers={"kid": kid})
    assert (await client.get("/api/auth/me", headers=hdr(forged))).status_code == 401
    # unknown kid -> 401
    unknown = jwt.encode({"sub": str(alice.id), "aud": "authenticated", "iss": f"{SUPABASE_URL}/auth/v1",
                          "exp": datetime.now(timezone.utc) + timedelta(hours=1)}, pem, algorithm=alg, headers={"kid": "zzz"})
    assert (await client.get("/api/auth/me", headers=hdr(unknown))).status_code == 401


async def test_algorithm_confusion_attack_fails(app, client, alice, monkeypatch):
    """Attacker signs HS256 using the (public) RSA key as the HMAC secret. Must not verify."""
    key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    pub_pem = key.public_key().public_bytes(serialization.Encoding.PEM, serialization.PublicFormat.SubjectPublicKeyInfo)
    monkeypatch.setattr(app.state.verifier._jwks, "fetch_data", lambda: _jwks_for(key.public_key(), "k1", "RS256"))
    # PyJWT itself refuses to sign HS256 with a PEM key (guard against exactly this attack); craft the token by hand.
    import base64, hashlib, hmac
    b64 = lambda b: base64.urlsafe_b64encode(b).rstrip(b"=")
    head = b64(json.dumps({"alg": "HS256", "typ": "JWT", "kid": "k1"}).encode())
    body = b64(json.dumps({"sub": str(alice.id), "aud": "authenticated", "iss": f"{SUPABASE_URL}/auth/v1",
                           "exp": int((datetime.now(timezone.utc) + timedelta(hours=1)).timestamp())}).encode())
    sig = b64(hmac.new(pub_pem, head + b"." + body, hashlib.sha256).digest())
    assert (await client.get("/api/auth/me", headers=hdr((head + b"." + body + b"." + sig).decode()))).status_code == 401


async def test_hs256_rejected_when_no_shared_secret_configured(app, client, alice):
    verifier = app.state.verifier
    saved = verifier._s.supabase_jwt_secret
    verifier._s.supabase_jwt_secret = None
    try:
        assert (await client.get("/api/auth/me", headers=alice.headers)).status_code == 401
    finally:
        verifier._s.supabase_jwt_secret = saved


# ── the direct-PostgREST privilege escalation the migration closes ─────────
async def test_authenticated_role_cannot_escalate_via_direct_sql(app, alice):
    """Simulates PostgREST: SET ROLE authenticated + own-row UPDATE (RLS allows it; the guard trigger neutralises it)."""
    async with app.state.db.transaction() as conn:
        await conn.execute("SET LOCAL ROLE authenticated")
        await conn.execute("SELECT set_config('request.jwt.claim.sub', $1, true)", str(alice.id))
        await conn.execute("UPDATE users SET role = 'admin', is_active = true, followers_count = 999, email = 'x@evil.io' WHERE id = $1", alice.id)
        row = await conn.fetchrow("SELECT role::text AS role, followers_count, email FROM users WHERE id = $1", alice.id)
        await conn.execute("RESET ROLE")
        raise_ = row  # noqa
    assert row["role"] == "trader" and row["followers_count"] == 0 and row["email"] == "alice@t.io"


async def test_authenticated_role_cannot_forge_post_counters_or_join_rpc(app, alice, bob):
    pid = await app.state.db.fetchval("INSERT INTO posts (user_id, content) VALUES ($1, 'x') RETURNING id", alice.id)
    async with app.state.db.transaction() as conn:
        await conn.execute("SET LOCAL ROLE authenticated")
        await conn.execute("SELECT set_config('request.jwt.claim.sub', $1, true)", str(alice.id))
        await conn.execute("UPDATE posts SET likes_count = 1000000, user_id = $2 WHERE id = $1", pid, bob.id)
        likes = await conn.fetchval("SELECT likes_count FROM posts WHERE id = $1", pid)
        owner = await conn.fetchval("SELECT user_id FROM posts WHERE id = $1", pid)
        await conn.execute("RESET ROLE")
    assert likes == 0 and owner == alice.id
    import asyncpg
    with pytest.raises(asyncpg.InsufficientPrivilegeError):
        async with app.state.db.transaction() as conn:
            await conn.execute("SET LOCAL ROLE authenticated")
            await conn.fetchval("SELECT join_session($1, $2)", uuid.uuid4(), bob.id)


async def test_alg_header_not_matching_jwk_type_is_401_not_500(app, client, alice, monkeypatch):
    """Regression: alg=ES256 whose kid resolves to an RSA key used to raise TypeError -> HTTP 500."""
    rsa_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    monkeypatch.setattr(app.state.verifier._jwks, "fetch_data", lambda: _jwks_for(rsa_key.public_key(), "mismatch", "RS256"))
    ec_key = ec.generate_private_key(ec.SECP256R1())
    pem = ec_key.private_bytes(serialization.Encoding.PEM, serialization.PrivateFormat.PKCS8, serialization.NoEncryption())
    tok = jwt.encode({"sub": str(alice.id), "aud": "authenticated", "iss": f"{SUPABASE_URL}/auth/v1",
                      "exp": datetime.now(timezone.utc) + timedelta(hours=1)}, pem, algorithm="ES256", headers={"kid": "mismatch"})
    assert (await client.get("/api/auth/me", headers=hdr(tok))).status_code == 401
