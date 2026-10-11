-- Restore the session approval column required by the active Next.js API.
--
-- A production probe found an older live_sessions table without this column.
-- That made both GET /api/sessions and POST /api/sessions fail before a host
-- could create a broadcast. This is a forward-only, idempotent repair for
-- projects whose historic backend-hardening migration was not applied.
--
-- Apply this after 20261011191252_repair_live_session_realtime_authorization.sql
-- when using the Supabase SQL editor. It is also safe under `supabase db push`.

BEGIN;

ALTER TABLE public.live_sessions
  ADD COLUMN IF NOT EXISTS requires_approval BOOLEAN;

UPDATE public.live_sessions
SET requires_approval = true
WHERE requires_approval IS NULL;

ALTER TABLE public.live_sessions
  ALTER COLUMN requires_approval SET DEFAULT true;

ALTER TABLE public.live_sessions
  ALTER COLUMN requires_approval SET NOT NULL;

COMMIT;
