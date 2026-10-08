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

The post-media migration creates the public `post-media` Storage bucket used
for social attachments. Uploads remain authenticated through the Next.js API;
there is no client-side write policy to configure.

For private Realtime authorization, disable **Allow public access** in
**Database → Replication → Realtime** after migration 019 is applied. Clients
use private `chat_<uuid>`, `session_<uuid>`, and `notifications_<uuid>` topics;
the database policies determine who may join or broadcast. Public market/news
topics do not accept client broadcasts.

- 013_social_interaction_reliability.sql — recalculates interaction counters and normalizes preferred-broker defaults.
- 014_remove_jack_d9e07f.sql — removes the requested @jack_d9e07f account and revokes its Supabase sessions.

## Live broadcast verification

Apply 019, 021, and `20261007213918_session_membership_realtime_access.sql`
before testing broadcasts. The last migration permits authenticated users to
read only their own membership row. Without it, the Realtime policy's membership
lookup is hidden by row security, even when the server confirms approval.
Do not disable row security or make session channels public to bypass this.
It also recreates the approval RPC when an older project missed migration 009,
so host approval/rejection works before the client joins the private topic.

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

1. Create an approval-required room as host. Request access as viewer.
2. Approve once; verify the viewer leaves the waiting room and stays approved.
3. Verify both rooms show **Signal connected**. Choose a screen/window/tab with
   Share Screen on a supported desktop browser. Check actual moving video in the
   viewer browser; the host's local preview is not proof of broadcast delivery.
4. Stop and restart sharing, then briefly disconnect/reconnect the viewer's
   network. Confirm delivery recovers. Repeat across two different networks to
   test TURN. Confirm `/api/webrtc/credentials?sessionId=<id>` returns 200 for an
   active host/viewer and denies pending/nonmembers. Do not copy credentials.
5. End the session and confirm the viewer leaves the media room within 5 seconds.

If connection stays unavailable, inspect the private channel error and verify
the migrations in the same Supabase project used by Vercel. No database migration
has been applied automatically. Local tests cover signaling lifecycle and API
ownership; they do not replace this two-browser media and production RLS check.
