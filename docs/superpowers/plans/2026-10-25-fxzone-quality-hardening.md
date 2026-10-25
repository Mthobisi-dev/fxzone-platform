# FxZone quality and production hardening

## Scope

Harden the existing Next.js, Supabase, Realtime, Storage, and Vercel application incrementally while preserving product behaviour and avoiding production data changes.

## Completed in this working pass

- Remove the unsupported Discover Add Trader profile-creation flow; keep registered-account search and follow actions.
- Keep followed accounts searchable through explicit Discover queries while excluding them from default suggestions.
- Treat Supabase profile lookup and verification errors as errors instead of missing profiles.
- Restrict authenticated profile and notification reads to explicit columns.
- Make account cleanup fail safely when dependent deletes fail; do not report false success.
- Replace raw database/provider error messages in high-risk profile, follow, session, participant, and notification responses with safe client messages and server diagnostics.
- Add regression tests for the Discover contract, profile provisioning, profile/privacy fields, notification fields, and API error contracts.

## Remaining audit work

1. Restore a clean dependency installation, then run lint, typecheck, tests, and production build.
2. Review remaining API routes for raw error leakage, service-role access, input limits, and private-data authorization.
3. Verify private chat media and Realtime policies against a non-production Supabase project.
4. Review destructive migrations without applying them to production; document migration order and manual approval requirements.
5. Validate market symbol/provider mappings, especially spot versus futures, with provider evidence.
6. Run browser-based responsive, accessibility, authentication, messaging, and live-session checks where the environment permits.

## Safety constraints

- Do not run destructive migrations or account-removal scripts against production.
- Do not commit secrets or expose service-role credentials.
- Do not push or deploy this branch without explicit authorization.
