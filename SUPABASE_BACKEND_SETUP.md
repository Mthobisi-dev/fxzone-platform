# Supabase backend setup

FxZone no longer has a Render or FastAPI backend. Authentication, database,
storage, realtime data, and transactional session state are provided by
Supabase. The Next.js API routes are the application boundary and must be
deployed with the frontend on a Next.js-compatible host.

## 1. Create the Supabase project

Create a project in the Supabase dashboard and configure the Auth providers
used by the application. Add the deployed site URL and local development URL
to **Authentication → URL Configuration**.

## 2. Apply the database migrations

In the Supabase SQL editor, run the tracked files in numerical order:

1. `supabase/migrations/001_join_session_rpc.sql`
2. `supabase/migrations/002_users_rls_insert.sql`
3. `supabase/migrations/003_users_rls_all.sql`
4. `supabase/migrations/004_fix_users_password_hash_and_trigger.sql`
5. `supabase/migrations/005_add_preferred_broker.sql`
6. `supabase/migrations/006_backend_hardening.sql`
7. `supabase/migrations/007_optional_lock_down_pii.sql`
8. `supabase/migrations/008_atomic_session_leave.sql`
9. `supabase/migrations/009_session_participant_review.sql`
10. `supabase/migrations/010_post_media_storage.sql`
11. `supabase/migrations/011_repair_profile_provisioning.sql`
12. `supabase/migrations/012_backfill_auth_user_profiles.sql`
13. `supabase/migrations/013_social_interaction_reliability.sql`
14. `supabase/migrations/015_interaction_counters_and_admin.sql`
15. `supabase/migrations/018_post_pinning.sql`
16. `supabase/migrations/019_realtime_authorization.sql`
17. `supabase/migrations/020_lock_down_user_pii.sql`
18. `supabase/migrations/021_fix_idempotent_session_join.sql`
19. `supabase/migrations/20261007213918_session_membership_realtime_access.sql`
20. `supabase/migrations/20261011191252_repair_live_session_realtime_authorization.sql`
21. `supabase/migrations/20261011205854_restore_live_session_approval_schema.sql`

Migration 020 is mandatory privacy hardening. It applies explicit public
profile-column grants and prevents browser clients from selecting email or
other private fields from `public.users`.

## 3. Configure the application

Copy `frontend/.env.example` to `frontend/.env.local` and set:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<publishable-key>
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
```

`SUPABASE_SERVICE_ROLE_KEY` belongs only in server-side hosting environment
settings. Do not use a `NEXT_PUBLIC_` prefix for it and do not commit it.

## 4. Verify the backend

Start the frontend with `npm run dev` from `frontend`, then request
`/api/health`. A working configured backend returns:

```json
{"status":"ok","backend":"supabase"}
```

The session join and leave endpoints use Supabase RPC transactions, which
prevents concurrent requests from exceeding capacity or corrupting viewer
counts.

The post-media migrations create the public `post-media` Storage bucket used
for social attachments. Files up to 4 MB are validated and uploaded through
the authenticated Next.js API. Larger attachments use a short-lived,
server-issued Supabase Storage upload token so a 90-second video does not
pass through Vercel's request-size limit. The bucket limits video uploads to
100 MB and has no general browser INSERT policy; do not add one.

For private Realtime authorization, disable **Allow public access** in
**Database → Replication → Realtime** after migration 019 is applied. Clients
use private `chat_<uuid>`, `session_<uuid>`, and `notifications_<uuid>` topics;
the database policies determine who may join or broadcast. Public market/news
topics do not accept client broadcasts.

- 013_social_interaction_reliability.sql — recalculates interaction counters and normalizes preferred-broker defaults.
- 014_remove_jack_d9e07f.sql — removes the requested @jack_d9e07f account and revokes its Supabase sessions.

## Live broadcast verification

Apply `20261011191252_repair_live_session_realtime_authorization.sql` and then
`20261011205854_restore_live_session_approval_schema.sql` after the existing
migrations before testing broadcasts. The first safely restores the private
Realtime policies, the authenticated user's own membership-read policy, and
the approval/join RPCs. The second restores `live_sessions.requires_approval`
for projects where an earlier backend-hardening migration was missed; without
it, the session list and Start Broadcast action return an error. Do not disable
row security or make session channels public to bypass this. Also apply the later
admission repairs in order: `20261012110000_enforce_live_session_follower_approval.sql`,
`20261012215233_broadcast_live_session_end.sql`,
`20261013071833_repair_live_session_admission_contract.sql`, and
`20261013113000_restore_live_session_host_admission.sql`. The last repair ensures
an old pending/rejected membership cannot make the session owner await approval.

In **Database → Replication → Realtime**, confirm **Allow public access** is
disabled. Supabase only enforces `realtime.messages` policies for private
channels. Disabling public access also prevents clients from joining public
topics. The browser must show **Connected** for both the host and an approved
viewer before sharing starts.

The waiting room now uses `GET /api/sessions/<id>/join` to read its own admission
state. Only the initial join uses POST. Approved/rejected decisions are not
overwritten by polling. A host ending the session is detected by this same poll.

For reliable connections across mobile networks, office firewalls and different
routers, configure these **server-only** Vercel variables for a working TURN
provider: `TURN_URL`, `TURN_SHARED_SECRET`, and optionally `TURN_TTL_SECONDS`.
STUN-only peer connections cannot connect across every network. A successful
Realtime subscription does not prove the media connection works. Supabase carries
the signaling messages; a TURN provider relays media when a direct route fails.

Deploy the current commit to the Vercel production project rooted at `frontend`.
Use two distinct accounts in separate browsers/devices:

1. Create a room as host. Confirm host controls open immediately, without approval.
   In a second account, follow the host and request access. The viewer should see
   **Request sent**; the host should see an **Approve** action under Access Requests.
2. Approve once; verify the viewer enters automatically and stays approved. A
   nonfollower must use **Follow & Request Access** before requesting admission.
3. Verify both rooms show **Connected**. Use **Share screen** in a supported
   desktop browser and choose a presentation tab/window. The picker discourages
   capturing the broadcast tab where supported. The host sees a sharing-status
   panel with no local video, preventing recursive screen feedback even if a
   whole monitor is selected. Verify moving video on the viewer's device.
   Viewers start muted; use **Enable audio** to hear audio shared by the host.
   **Mute shared audio** controls the capture's audio, not a microphone. Select
   the browser's tab-audio option if sound is needed. **Pause shared video** pauses
   the screen track, not a camera. Recording requires an active shared screen.
4. Stop and restart sharing, then briefly disconnect/reconnect the viewer's
   network. Confirm delivery recovers. Repeat across two different networks to
   test TURN. Confirm `/api/webrtc/credentials?sessionId=<id>` returns 200 for an
   active host/viewer and denies pending/nonmembers. Do not copy credentials.
5. End the session and confirm the viewer leaves the media room within 5 seconds.
6. Cancel a pending request. Verify it disappears from the host's requests. Test
   a declined request and an interrupted connection; neither may enter the private
   room. On a phone, scroll to requests/chat and verify the controls fit the screen.
7. Click Share twice quickly, cancel the picker, and retry. Only one picker should
   open. Stop sharing using the browser toolbar and verify capture/audio/recording
   stop. Leave while a picker is open; accepting it must not keep capturing.

If connection stays unavailable, inspect the private channel error and verify
the migrations in the same Supabase project used by Vercel. The broadcast role/privacy repair was applied and verified on the connected production project on 2026-10-14. Local tests cover signaling lifecycle and API
ownership; they do not replace this two-browser media and production RLS check.

### Broadcast repair verification (2026-10-14)

`20261014051643_repair_broadcast_participant_roles_and_privacy.sql` adds the
missing `pending` and `rejected` participant-role values and removes the generic
broadcast SELECT policy that bypassed scoped topic authorization. It has been
applied to the connected production project. Other environments need this
migration after the scoped Realtime policies; commit it before using new enum
values. The migration is idempotent and does not delete users or sessions.

Both rollback-only SQL tests in `supabase/tests/` passed against production:
- `live_session_admission.sql`: immediate host admission, pending follower,
  denial of nonfollowers/nonhost approval, host approval, stale host repair.
- `live_session_realtime.sql`: authenticated host/viewer signaling allowed;
  pending users and nonmembers denied for both reads and writes. Test messages
  use `skip_broadcast`; no test data persists.

Application verification passed: 71 tests, typecheck, `npm run lint -- --quiet`
(existing warnings remain), and production build. Real two-device audio/video
and cross-network TURN delivery still need the manual checklist above.

The post-migration security advisor also reported existing issues outside this
broadcast repair: RLS tables without policies (including chat membership),
trigger-function execute grants, a mutable function search path, the pg_trgm
extension in public, and disabled leaked-password protection. Do not solve these
by granting blanket access. See the [Supabase database linter](https://supabase.com/docs/guides/database/database-linter)
and [password protection](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).
