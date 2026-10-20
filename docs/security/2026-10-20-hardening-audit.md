# FxZone hardening audit — 2026-10-20

This audit was performed against commit `7349677b5489ba70856ed01630fd80952b38c663` on branch `fix/fxzone-security-reliability-hardening`. It is an initial code audit; no production database or deployment was touched.

## P0 — security, privacy, and data integrity

- **Private story authorization is inconsistent.** The single-post endpoint uses a privileged client and returns any post by ID without applying story audience and expiry rules. Related interaction paths need the same authorization decision. Impact: a user who knows a post ID may access restricted story content.
- **Chat attachments use the public social media upload path.** `MessageInput` sends conversation media to `/api/social/posts/upload`, which stores objects in the public `post-media` bucket and returns permanent public URLs. Impact: private conversation media can be downloaded without membership authorization.
- **AI chat contains fabricated financial values and unsupported claims.** `frontend/app/api/ai/chat/route.ts` constructs indicators from arbitrary price multipliers, emits fixed confidence, and uses hardcoded provider fallbacks. Impact: users can mistake generated values for verified research.
- **Post deletion can report success after a failed database delete.** The post route falls back to a soft marker and returns success after a hard-delete error. Impact: data integrity and client state become misleading.

## P1 — core reliability and authorization

- **Chat message length is inconsistent.** The API accepts 10,000 characters while the database constraint is 4,000, causing avoidable insertion failures.
- **Chat read receipts are not awaited.** The GET messages route starts the `last_read_at` update without awaiting or handling its result in a serverless request.
- **Failed optimistic sends are removed.** The chat page drops a temporary message on failure, leaving users without a retryable message state.
- **Profile response is broader than necessary.** `/api/auth/me` uses broad profile selection and needs an explicit response allowlist.
- **Large chat uploads pass through a social upload function.** This risks request-body limits and lacks conversation-specific authorization.

## P2 — operations and maintainability

- Baseline lint/typecheck/build/test status must be captured on this branch before claiming readiness.
- Existing migration history includes operational account-deletion work; no historical migration will be rewritten or executed during this repair.
- WebRTC and Realtime code already has private-channel work from earlier changes; it requires focused permission and state-transition tests rather than an uncontrolled rewrite.

## Planned verification

The fixes will be implemented incrementally with focused unit/API tests, then validated with `npm run lint`, `npm run typecheck`, `npm test`, and `npm run build` from `frontend/`. Any unavailable external-provider, Supabase, TURN, or browser integration will be reported as unverified.

## Baseline and current verification

- `npm run lint`: PASS (zero errors; the repository is configured to reject warnings).
- `npm run typecheck`: PASS.
- `npm test`: PASS (161 tests).
- `npm run build`: the default Turbopack build hit a Windows process-start panic while parsing CSS. A webpack build completed successfully once, including TypeScript, static generation, and route output. A final webpack rerun later hit a Windows `EPERM` while creating a generated `.next/server/app/api/notifications` directory; no source error was reported. Re-run the build in CI/Linux or after the local filesystem lock is cleared before release.
