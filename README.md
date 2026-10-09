# FxZone Platform

FxZone is a social trading application for market analysis, community posts, chat, watchlists, live trading sessions, and optional AI assistance.

## Production architecture

```text
Browser
  -> Next.js 16 App Router (Vercel)
  -> /api route handlers
  -> Supabase PostgreSQL, Auth, Realtime, and Storage
```

The active production path is **Next.js + Supabase + Vercel**. There is no active FastAPI, Render, or Netlify dependency.

## Stack

- Next.js 16 and React 19
- TypeScript and ESLint
- Supabase Auth, PostgreSQL, Realtime, and Storage
- Zustand for client state
- WebRTC for live sessions, with optional TURN REST credentials
- Gemini integration when configured

## Repository layout

```text
frontend/                 Next.js app, API route handlers, components, and client state
supabase/migrations/      Production database migrations, in order
scripts/                  One-off maintenance utilities; not part of the Vercel runtime
SUPABASE_BACKEND_SETUP.md Supabase project setup notes
```

## Local development

Prerequisites: Node.js 20 or later, npm, and a Supabase project.

```bash
git clone https://github.com/Mthobisi-dev/fxzone-platform.git
cd fxzone-platform/frontend
npm ci
copy .env.example .env.local
npm run dev
```

On macOS or Linux, replace `copy` with `cp`. The application is then available at `http://localhost:3000`.

## Environment configuration

`frontend/.env.example` is the only environment template. Set these values in `.env.local` locally and in the Vercel project for each deployment environment.

Public values:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `NEXT_PUBLIC_SITE_URL`

Server-only values:

- `SUPABASE_SERVICE_ROLE_KEY` — required by existing trusted route handlers; never expose it to the browser.
- `GEMINI_API_KEY` — only when AI features are enabled.
- `TURN_URL`, `TURN_SHARED_SECRET`, and optionally `TURN_TTL_SECONDS` — only for a coturn-compatible TURN REST deployment.
- `TWELVE_DATA_API_KEY` — required for verified stock, forex, metal, and historical candle data.
- `COINGECKO_DEMO_API_KEY` — optional; increases CoinGecko crypto-quote quota.

The client receives short-lived TURN credentials from `/api/webrtc/credentials` only after it has authenticated and joined the requested live session. Do not add permanent TURN credentials under a `NEXT_PUBLIC_` name.

## Supabase setup and migrations

Apply the SQL files under `supabase/migrations/` to the intended Supabase project in filename order. Migrations must be reviewed and applied through the Supabase CLI or SQL editor; Vercel deployments do not apply database migrations automatically.

The authenticated user ID must map to `public.users.id`. Existing route handlers preserve compatibility with the current production schema while the migration baseline is being consolidated.

## Quality checks

Run these from `frontend/` before deploying:

```bash
npm ci
npm run lint
npm run typecheck
npm run test
npm run build
```

The repository is being migrated to automated test coverage. Any future `npm run test` script must be backed by committed tests; do not treat an empty test command as a quality gate.

## Vercel configuration

Configure the Vercel project as follows:

| Setting | Value |
| --- | --- |
| Root Directory | `frontend` |
| Framework Preset | Next.js |
| Install Command | `npm ci` |
| Build Command | `npm run build` |
| Output Directory | leave empty / auto-detected |

Set environment variables in Vercel rather than committing a `.env.local` file. The tracked `frontend/vercel.json` provides compatible response headers.

## Operational notes

- `/api/health` intentionally returns only a minimal healthy or unhealthy status. It does not expose database errors or environment configuration.
- API requests include the current Supabase bearer token. A 401 response triggers a single session refresh and retry.
- The service-role Supabase client bypasses RLS. It remains in use by established route handlers while authorization checks are moved to user-context clients incrementally. New privileged operations must verify the caller before querying or mutating data.

## Troubleshooting

If a signed-in action reports a missing Supabase server key, add `SUPABASE_SERVICE_ROLE_KEY` to the Vercel environment and redeploy. If a browser action reports missing public configuration, set both `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` and rebuild, because public Next.js variables are embedded at build time.

For live-session relay failures, verify that the TURN provider supports the TURN REST shared-secret scheme and that `TURN_URL` uses `turn:` or `turns:` URLs. WebRTC still attempts direct/STUN connections when TURN is deliberately not configured.

Market tiles only display values received from CoinGecko or Twelve Data. A provider outage is shown as **Unavailable**; a recent cached provider quote is marked **Stale**. The dashboard does not generate fallback prices, percent changes, or candles. Configure `TWELVE_DATA_API_KEY` in Vercel before expecting non-crypto instruments or historical charts.

## Financial disclaimer

Market data, AI analysis, technical charts, and social content are for informational and educational purposes only. They are not investment or trading advice. Trading forex, cryptocurrencies, CFDs, and equities carries risk.
