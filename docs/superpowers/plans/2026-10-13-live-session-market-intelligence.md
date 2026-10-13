# Live Session Admission and Market Intelligence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make follower-gated live broadcasts understandable and reliable, then expose verified instrument metadata and structured research without fabricating market facts.

**Architecture:** A forward-only Supabase migration will make the session admission contract consistent across partially migrated environments. The client will guide a follower through an idempotent follow-and-request flow while database RPCs remain the authorization authority. The dashboard will preserve provider-backed metrics, use canonical asset classifications, and render deterministic research sections alongside optional AI wording.

**Tech Stack:** Next.js 16 App Router, TypeScript, Supabase PostgreSQL/RLS/Realtime, Node test runner.

**Spec:** User request in this conversation on 2026-10-13.

## Global Constraints

- Keep private Realtime authorization in PostgreSQL; do not make client state authoritative.
- Do not modify Supabase-owned `realtime.messages` with `ALTER TABLE`.
- Never fabricate live prices, market caps, provider volume, or technical analysis.
- Keep legacy follow toggles compatible while supporting explicit idempotent follow requests.
- Preserve the existing dashboard layout and mobile behavior.

## Review Focus

- A non-follower must see a specific follow-and-request action rather than an opaque join failure; covered by live-session permission tests and page-state logic.
- A pending or rejected participant must never mount WebRTC controls; covered by `canEnterLiveBroadcastRoom` tests.
- A session host must retain a visible host role without granting viewer media controls; covered by role helper tests and server RPC guards.
- Missing provider market-cap data must remain unavailable rather than falling back to a guessed value; covered by screener tests.
- Structured research must withhold technical sections when historical candles are absent; covered by selected-asset explanation tests.

---

### Task 1: Repair the live-session admission contract

**Files:**
- Create: `supabase/migrations/<timestamp>_repair_live_session_admission_contract.sql`
- Modify: `supabase/migrations/liveSessionRealtimeRepair.test.js`
- Modify: `frontend/lib/liveSessionPermissions.ts`
- Modify: `frontend/lib/live-session.test.js`

**Interfaces:**
- Produces: `canEnterLiveBroadcastRoom(role)` and `getLiveSessionRoleLabel(role)`.
- Produces: idempotent `join_session(uuid, uuid)` and `review_session_participant(uuid, uuid, uuid, text)` RPC contracts restricted to `service_role`.

- [ ] Write migration and role-helper tests for active roles, follower/approval gates, fixed search paths, RPC grants, and Realtime policies.
- [ ] Run the focused tests and confirm the missing helper/migration assertions fail.
- [ ] Implement the smallest helper functions and forward-only migration that repairs approval schema, RLS, RPCs, and private channel policies.
- [ ] Run focused tests, then the full test suite.

### Task 2: Make broadcast access and host responsibility clear

**Files:**
- Modify: `frontend/app/(dashboard)/session/[id]/page.tsx`
- Modify: `frontend/app/api/social/users/[id]/follow/route.ts`
- Modify: `frontend/components/live/SessionRoom.tsx`

**Interfaces:**
- Consumes: `canEnterLiveBroadcastRoom(role)` and `getLiveSessionRoleLabel(role)`.
- Produces: optional `{ following: boolean }` follow request body with no toggle race.

- [ ] Write a focused behavior test for explicit follow intent and role-room gating.
- [ ] Run it and confirm it fails against the current toggle-only/generic-error behavior.
- [ ] Add the explicit follow intent, follow-and-request UI, and host role badge while retaining server-side RPC authorization.
- [ ] Run the focused and full test suites.

### Task 3: Organize verified research for the selected instrument

**Files:**
- Modify: `frontend/lib/server/selectedAssetExplanation.ts`
- Modify: `frontend/app/api/market/explanation/[symbol]/route.ts`
- Modify: `frontend/components/trading/VerifiedAssetDetail.tsx`
- Modify: `frontend/lib/server/selectedAssetExplanation.test.js`
- Modify: `frontend/components/trading/VerifiedAssetDetail.test.js`

**Interfaces:**
- Produces: `research` sections for market snapshot, calculated technical context, and data quality.
- Consumes: verified quote, calculated indicators, and optional AI narrative.

- [ ] Write failing tests that expect structured sections and absence of technical content without historical data.
- [ ] Implement deterministic sections, retaining optional AI wording as a bounded summary only.
- [ ] Render compact accessible research cards and verify the tests.

### Task 4: Make screener controls use verified and classified data

**Files:**
- Modify: `frontend/lib/server/marketService.ts`
- Modify: `frontend/lib/marketScreener.ts`
- Modify: `frontend/lib/marketDashboard.ts`
- Modify: `frontend/lib/marketHeatmap.ts`
- Modify: `frontend/components/trading/LiveMarketScreener.tsx`
- Modify: `frontend/stores/marketStore.ts`
- Modify: corresponding market unit tests

**Interfaces:**
- Produces: provider-backed `market_cap` where supplied, provider `volume`, canonical `sector`, market-cap/sector filtering, and selectable size/color metrics.

- [ ] Write failing tests for preserved market caps, sector filtering, size metric selection, and unavailable-provider behavior.
- [ ] Implement only provider-backed numeric fields and explicit unavailable states; add canonical asset classifications for filtering.
- [ ] Replace static screener labels with real filters/metric selectors and accessible labels.
- [ ] Run market tests, full tests, lint, typecheck, and production build.

### Task 5: Verify and deliver safely

**Files:**
- Modify: all files above only as required by verification fixes.

- [ ] Inspect the diff for unplanned changes and stage only task files.
- [ ] Run `npm run test`, `npm run lint`, `npm run typecheck`, and `npm run build` from `frontend`.
- [ ] Commit the cohesive change and push `main`.
- [ ] Report actual verification results and the required Supabase migration application step.
