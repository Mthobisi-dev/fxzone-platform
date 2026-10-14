-- Existing join/review functions use these approval states.
-- Commit this migration before invoking those functions with the new enum values.
ALTER TYPE public.participant_role ADD VALUE IF NOT EXISTS 'pending';
ALTER TYPE public.participant_role ADD VALUE IF NOT EXISTS 'rejected';

-- PostgreSQL permissive policies are ORed: the generic broadcast policy
-- bypasses topic membership even when the private policies are present.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'realtime'
    AND tablename = 'messages' AND policyname = 'fxzone_realtime_private_read'
    AND cmd = 'SELECT'
  ) OR NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'realtime'
    AND tablename = 'messages' AND policyname = 'fxzone_realtime_private_write'
    AND cmd = 'INSERT'
  ) THEN
    RAISE EXCEPTION 'Install the scoped FxZone Realtime read/write policies first';
  END IF;
END $$;
DROP POLICY IF EXISTS "Allow listening for broadcasts for authenticated users only"
ON realtime.messages;
