"""Local development helper: create a user in the (stub) auth schema and print a Bearer token for it.

    python scripts/dev_token.py alice            # trader
    python scripts/dev_token.py root --admin
Requires the docker-compose stack (or any DB built by tests/sql/apply.sh) and the same SUPABASE_JWT_SECRET as the API.
"""
import argparse, asyncio, json, os, uuid
from datetime import datetime, timedelta, timezone

import asyncpg, jwt


async def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("username")
    ap.add_argument("--admin", action="store_true")
    a = ap.parse_args()
    dsn = os.environ.get("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/fxzone")
    secret = os.environ.get("SUPABASE_JWT_SECRET", "dev-only-secret-change-me-32-characters-min")
    conn = await asyncpg.connect(dsn)
    row = await conn.fetchrow("SELECT id FROM users WHERE username = $1", a.username)
    uid = row["id"] if row else uuid.uuid4()
    if not row:
        await conn.execute("INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES ($1,$2,$3::jsonb)",
                           uid, f"{a.username}@example.com", json.dumps({"username": a.username}))
        await conn.execute("UPDATE users SET username = $2 WHERE id = $1", uid, a.username)
    if a.admin:
        await conn.execute("UPDATE users SET role = 'admin' WHERE id = $1", uid)
    await conn.close()
    claims = {"sub": str(uid), "aud": "authenticated", "role": "authenticated", "email": f"{a.username}@example.com",
              "exp": datetime.now(timezone.utc) + timedelta(days=7)}
    if os.environ.get("SUPABASE_URL"):  # the API verifies `iss` whenever SUPABASE_URL is configured
        claims["iss"] = os.environ["SUPABASE_URL"].rstrip("/") + "/auth/v1"
    print(jwt.encode(claims, secret, algorithm="HS256"))


asyncio.run(main())
