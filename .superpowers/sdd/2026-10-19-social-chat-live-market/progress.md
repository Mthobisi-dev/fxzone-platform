# SDD ledger — plan: docs/superpowers/plans/2026-10-19-social-chat-live-market-plan.md

Execution: native inline implementation.
Pre-flight: Task 1 creates unread/asset-tag helpers consumed by navigation and social surfaces; Task 2 independently consumes chat state and does not depend on Task 1 internals.
Pre-flight: Tasks 3–5 preserve existing provider, news, and live-session route contracts; no schema migration is planned unless inspection proves an existing contract insufficient.

Task 1: complete (focused tests: `node --test lib/postAssetTags.test.js` → 5/5 pass; typecheck → PASS). Ruling: caption removal is UI and payload cleanup because the composer already stores post body content; cost if wrong: clients relying on a separate caption field would lose that optional field, but the requested UX explicitly removes it.

Task 2: complete (focused tests: direct conversation, social navigation, and chat surface contracts pass; typecheck → PASS). Ruling: deleting a conversation removes only the authenticated user's membership, preserving other participants and messages; client-side deduplication complements the existing canonical RPC/list behavior. Mobile chat extends through the fixed footer safe area to remove the blank strip.

Task 3: complete (focused interval and signal tests → 2/2 pass; typecheck → PASS). Ruling: chart controls now expose only intervals supported by the existing Yahoo/Twelve Data provider adapters; structured signal sharing rejects unknown instruments/levels and preserves provider/timestamp provenance.

Task 4: complete (focused density and evidence tests → 2/2 pass; typecheck → PASS). Ruling: workspace density is mapped through existing settings (`scalper`→compact, `beginner`→comfortable) without inventing a new persisted mode; news evidence is rendered only from provider source, timestamps, tags, and article facts, with explicit uncertainty.

Task 5: complete (screen-share capability test → 1/1 pass; typecheck → PASS). Ruling: native `getDisplayMedia` remains the only support signal; iOS/restricted browsers receive truthful actionable messaging and no capture attempt is made when unsupported.

Task 6: complete. `npm run lint` PASS, `npm run typecheck` PASS, `npm run test` PASS (160/160), `git diff --check` PASS. Both default Turbopack and webpack production builds were attempted; this Windows host failed during `.next` child-process/output directory creation (Turbopack panic and webpack EPERM), so deployment CI/Vercel must perform the authoritative Node 22 build.

Post-task correction: PostCard now renders recognized symbols found in post text alongside explicit tags, and the repost flow no longer exposes or sends the removed optional-caption field. Focused social tests and typecheck remain passing.
