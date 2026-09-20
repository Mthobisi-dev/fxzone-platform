# FxZone API (FastAPI)

Standalone backend for the FxZone frontend. It implements the **exact `/api/*` contract the frontend already uses**
(all 56 distinct calls found in `frontend/` are covered, including seven that the built-in Next.js routes never
implemented), on top of the same Supabase project: Supabase Auth tokens, Supabase Postgres, Supabase Storage and
Supabase Realtime.

```
Browser ──/api/*──▶ Next.js ──rewrite (BACKEND_URL)──▶ FastAPI ──asyncpg──▶ Supabase Postgres
   ▲                                                      │  ├─ Redis  (rate limits, quote cache, job leader lock)
   └──── Supabase Realtime channels ◀── HTTP broadcast ───┘  ├─ Supabase Storage / Auth Admin API (service role)
                                                              └─ Yahoo/CoinGecko (quotes, candles) · RSS · Gemini (optional)
```

The Next.js routes are untouched: with `BACKEND_URL` unset the app behaves exactly as before, so switching is a
deploy-time decision and trivially reversible.

## Switching over

1. **Database** – run `supabase/migrations/006_backend_hardening.sql` (after your existing `001`–`005`) in the Supabase SQL editor (idempotent; compatible
   with the old routes, so it is safe to apply first). It fixes real schema bugs, see *What was broken* below.
2. **Deploy this service** on a host that keeps a long-running process (Render, Fly.io, Railway, a VM…). Not Vercel
   functions: it runs background jobs (price refresh/broadcast, news ingest). Use `Dockerfile` and `.env.example`.
   Run **one Redis** (Upstash/Render/Fly) – required in production when you run more than one worker/instance.
3. **Point the frontend at it**: set `BACKEND_URL=https://<your-api-host>` in the frontend's environment and redeploy.
   `next.config.mjs` then proxies `/api/*` (no CORS setup needed). Alternatively call the API cross-origin and set
   `CORS_ORIGINS`.
4. **Optional, after step 3 is live**: `007_optional_lock_down_pii.sql` stops anyone holding the public anon key from
   reading every user's email via Supabase's REST API (`/rest/v1/users?select=email`). Not applied automatically because
   the legacy Next routes need the service-role key for it not to break them.

Local development: `docker compose -f backend/docker-compose.yml up --build`, then
`python scripts/dev_token.py alice` mints a Bearer token for the stubbed auth schema.

## Endpoints

| Area | Endpoints |
|---|---|
| Health | `GET /health`, `/health/ready` (db, redis, feature flags) |
| Auth | `GET/PUT/DELETE /api/auth/me` (incl. `preferred_broker`) |
| Feed & posts | `GET /api/social/feed`, `GET/POST /posts`, `GET/DELETE /posts/{id}`, `/posts/{id}/react\|repost\|bookmark\|pin\|comments`, `GET /posts/saved`, `DELETE /posts/purge-all`, `POST /posts/upload`, `DELETE /comments/{id}` |
| Social | `GET/POST /stories`, `/trending-symbols`, `/featured-experts`, `GET /users`, `GET /users/{id or username}`, `/users/{id}/posts`, `POST /users/{id}/follow` |
| Chat | `GET/POST /api/chat/conversations`, `GET/PATCH /{id}`, `GET/POST /{id}/messages`, `POST /{id}/read`, `POST /{id}/members`, `DELETE /{id}/members/{id\|me}` |
| Live sessions | `GET/POST/DELETE /api/sessions`, `GET/DELETE /{id}`, `POST /{id}/join\|leave\|end`, `GET /{id}/participants`, `POST /{id}/approve/{uid}\|reject/{uid}`, `DELETE /history` |
| Notifications | `GET/PUT /api/notifications`, `GET /unread-count`, `PUT /read-all`, `PUT /{id}/read` |
| Market | `GET /api/market/assets\|prices\|quotes`, `/prices/{symbol}/history`, watchlist CRUD + items |
| News / AI | `GET /api/news/feed`, `GET /api/ai/insights`, `GET /api/ai/sentiment/{symbol}`, `POST /api/ai/chat` |

Interactive docs at `/docs` (disabled in production). Errors are always `{"detail": "...", "code": "...", "request_id": "..."}`.

## Realtime contract

The frontend subscribes to Supabase Realtime broadcast channels (`frontend/lib/websocket.ts` turns `/ws/chat/123` into
the channel `chat_123`). The backend publishes to the same names through Supabase's HTTP broadcast API, so nothing in
the browser changes:

| Channel | Event → payload |
|---|---|
| `market` | `prices` → `{data: {SYMBOL: quote}}` |
| `news` | `breaking_news` → `{data: {id,title,source,summary}}` |
| `chat_<conversationId>` | `new_message` → the message object |
| `notifications_<userId>` | `notification` → `{notification}` |
| `session_<sessionId>` | `participant_approved`/`participant_rejected` → `{user_id}`, `session_ended`, `members_update` → `{data:{count}}` |

Notifications moved from one shared channel to a per-user channel (a shared one would deliver everybody's
notifications to every client); this is the one-line change in `NotificationDropdown.tsx`.
If Realtime isn't configured the API keeps working and the UI falls back to the polling it already has.

## Security model

- **Tokens**: verified cryptographically per request. HS256 only if `SUPABASE_JWT_SECRET` is set; RS256/ES256 via the
  project JWKS otherwise. Algorithm chosen from an allow-list; `none`, algorithm confusion, wrong audience/issuer,
  expiry and mismatched key types are all rejected with 401. Repeated bad tokens are throttled per IP.
- **Authorisation** comes from `public.users.role` in the database – never from token metadata or e-mail address.
  (The old routes hard-coded two admin e-mails.) A user's profile is provisioned as `trader` only.
- **Ownership checks** on every mutation (posts, comments, pins, watchlists, notifications, conversations, sessions).
- **Uploads**: type detected from magic bytes (client filename/type ignored), allow-list only (no SVG/HTML), size
  capped while streaming, random server-side names under `<user id>/`.
- **Input**: pydantic schemas with length limits, http(s)-only URLs, LIKE-wildcard escaping, parameterised SQL only.
- **Abuse**: per-user/IP rate limits (429 + `Retry-After`), request-size limits, request ids, JSON logs, security headers.
- **Production refuses to start** with: no TLS to Postgres, no Redis (unless explicitly allowed), local file storage,
  wildcard CORS, or no way to verify tokens.
- **Database triggers** (migration 006) stop direct PostgREST writes from changing `role`, `is_active`, counters or
  post ownership, and revoke the `join_session` RPC from API roles.

## Data honesty

Anything the UI shows as data is computed or fetched, never invented:

- `prices`/`quotes` come from CoinGecko (crypto) and Yahoo Finance (the rest) with a `data_source`, the fetch
  `timestamp` and `is_stale`. `bid`/`ask` are `null` (providers don't supply them). If a provider is down you get the
  last known quote flagged stale, or an empty list – not hard-coded prices.
- `/prices/{symbol}/history` returns real candles, or `503`. (It used to return `Math.random()` candles.)
- `/api/ai/*` computes RSI, EMA 20/50/200, MACD, Bollinger, ATR from those candles. `confidence` is an
  **indicator-agreement score** (fraction of decisive indicators pointing the same way) – it is not a probability, and
  the response says so (`confidence_basis`). Gemini, if configured, only narrates the computed numbers.
- `/api/news/feed` returns ingested RSS headlines (title + short snippet + link) with a simple keyword sentiment. It is
  empty until the first ingest rather than showing placeholder stories.

The market providers are free/unofficial endpoints without an SLA. For a commercial trading product, swap in a licensed
data vendor by replacing `services/market/providers.py` (two coroutines).

## What was broken in the existing code (all fixed here)

| Issue | Effect |
|---|---|
| `participant_role` enum had no `pending` | the whole join-approval flow errored at the database |
| `saved_posts` table doesn't exist (real table: `bookmarks`) | saving posts never worked |
| RLS let any user `UPDATE users SET role='admin'` through Supabase's REST API | privilege escalation |
| `join_session(p_session_id, p_user_id)` callable by any signed-in user as anyone | approval bypass |
| Counters updated by read-modify-write (and never for comments) | lost updates, wrong counts |
| Pin route had no ownership check; watchlist item routes used the service role with no ownership check | any user could pin any post / edit anyone's watchlist |
| Public `/api/social/users` selected every user's e-mail | PII leak |
| `/api/market/quotes` returned an object; the feed page requires an array | trending panel always showed 0.00% |
| 7 endpoints called by the UI had no route (`DELETE /comments/{id}`, `POST /stories`, `/sessions/{id}/end\|participants\|approve\|reject`, `GET /chat/conversations/{id}`) | features silently failing |
| `requires_approval`, `caption`, `asset_tags`, `allow_*`/`show_*` sent by the UI were dropped | settings ignored |
| Random candles, static "news", template "AI" with invented indicators/confidence | fabricated data presented as analysis |

## Tests

```bash
pip install -r requirements-dev.txt
pytest          # rebuilds `fxzone_test` from supabase_schema.sql + all migrations (needs psql + Postgres; Redis for 2 tests)
```
`TEST_PG_BASE` overrides the Postgres location. The suite (174 tests) runs against real Postgres and Redis with the
network mocked, and covers auth/JWT attacks, permissions, races (likes, follows, DM creation, session capacity), the
migration's triggers, uploads, market/AI/news logic and realtime payload shapes.

## Verification status – read this

**Verified** (in a sandbox): the 169 tests above; real Postgres 16 + Redis; a real `uvicorn` process (readiness, CORS,
error shape); a production `next build` + `tsc --noEmit` with `BACKEND_URL` set, proving `/api/*` reaches this service.
Mutation checks confirmed the tests fail when key protections are removed.

**Not verified** (no access from the sandbox – please smoke-test after deploying):
Live Supabase (JWKS endpoint, Storage upload, Realtime HTTP broadcast, Auth Admin API, the pooler on port 6543);
live Yahoo/CoinGecko/Gemini/RSS responses (all mocked from documented response shapes; check `GEMINI_MODEL` against
Google's current list); the Docker image build; behaviour under load; multi-MB uploads through the Next.js rewrite proxy
(if they fail, call the API cross-origin for `/api/social/posts/upload`).

## Known limitations / next steps

- Realtime channels are public broadcast channels (as the frontend already used them): anyone who knows a conversation
  UUID can subscribe to `chat_<uuid>`. Moving to private channels + RLS on `realtime.messages` (requires a small client
  change) is the recommended hardening.
- WebRTC signalling and in-session chat remain client-to-client broadcasts on `session_<id>` (unchanged).
- Sentiment for news is a keyword lexicon; the AI signal is a rule-based indicator vote. Both are labelled as such.
- Watchlists reject unknown symbols (404) instead of auto-creating asset rows the way the Next.js route does: that would
  let any user fill the `assets` table. The full catalogue (37 assets) is synced into `assets` at startup, so every asset
  the UI can offer already exists.
- `preferred_broker` is free text (max 100 chars, default `Exness`, empty resets to the default) so the UI's broker list
  can grow without a backend deploy.
- Account deletion removes the Supabase identity (cascading to all rows) but not uploaded storage objects.
