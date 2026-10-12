-- Publish an authoritative end-of-session event to the existing private room.
--
-- The API changes live_sessions.status to `ended`, while connected viewers
-- listen on session_<live session UUID> for a `session_ended` Broadcast event.
-- Using the database keeps the event authoritative and prevents a browser
-- client from impersonating an end action.

BEGIN;

CREATE OR REPLACE FUNCTION public.broadcast_live_session_end()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, realtime
AS $$
BEGIN
  PERFORM realtime.send(
    jsonb_build_object(
      'session_id', NEW.id,
      'status', NEW.status,
      'ended_at', NEW.ended_at
    ),
    'session_ended',
    'session_' || NEW.id::text,
    true
  );

  RETURN NEW;
END;
$$;

-- The function is invoked only by the trigger. It must not become a public
-- SQL API that a browser can call directly.
REVOKE ALL ON FUNCTION public.broadcast_live_session_end() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.broadcast_live_session_end() FROM anon;
REVOKE ALL ON FUNCTION public.broadcast_live_session_end() FROM authenticated;

DROP TRIGGER IF EXISTS trg_broadcast_live_session_end ON public.live_sessions;
CREATE TRIGGER trg_broadcast_live_session_end
AFTER UPDATE OF status ON public.live_sessions
FOR EACH ROW
WHEN (OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'ended')
EXECUTE FUNCTION public.broadcast_live_session_end();

COMMIT;
