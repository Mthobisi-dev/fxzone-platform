-- Private Realtime topic authorization for FxZone.
--
-- Topic convention:
--   chat_<conversation UUID>          authenticated conversation members
--   session_<live session UUID>       active (host/viewer) participants only
--   notifications_<user UUID>         only the named user
--
-- Supabase manages RLS on realtime.messages. Do not run ALTER TABLE on that
-- system relation. These policies are evaluated when a private channel joins
-- and when a client broadcasts. The browser must use config.private = true.

DROP POLICY IF EXISTS fxzone_realtime_private_read ON realtime.messages;
DROP POLICY IF EXISTS fxzone_realtime_private_write ON realtime.messages;

CREATE POLICY fxzone_realtime_private_read
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  realtime.messages.extension IN ('broadcast', 'presence')
  AND (
    (
      realtime.topic() LIKE 'chat_%'
      AND EXISTS (
        SELECT 1
        FROM public.conversation_members AS member
        WHERE member.user_id = auth.uid()
          AND member.conversation_id::text = substring(realtime.topic() FROM '^chat_(.+)$')
      )
    )
    OR (
      realtime.topic() LIKE 'session_%'
      AND EXISTS (
        SELECT 1
        FROM public.session_participants AS participant
        WHERE participant.user_id = auth.uid()
          AND participant.left_at IS NULL
          AND participant.role IN ('host', 'viewer')
          AND participant.session_id::text = substring(realtime.topic() FROM '^session_(.+)$')
      )
    )
    OR realtime.topic() = ('notifications_' || auth.uid()::text)
  )
);

CREATE POLICY fxzone_realtime_private_write
ON realtime.messages
FOR INSERT
TO authenticated
WITH CHECK (
  realtime.messages.extension IN ('broadcast', 'presence')
  AND (
    (
      realtime.topic() LIKE 'chat_%'
      AND EXISTS (
        SELECT 1
        FROM public.conversation_members AS member
        WHERE member.user_id = auth.uid()
          AND member.conversation_id::text = substring(realtime.topic() FROM '^chat_(.+)$')
      )
    )
    OR (
      realtime.topic() LIKE 'session_%'
      AND EXISTS (
        SELECT 1
        FROM public.session_participants AS participant
        WHERE participant.user_id = auth.uid()
          AND participant.left_at IS NULL
          AND participant.role IN ('host', 'viewer')
          AND participant.session_id::text = substring(realtime.topic() FROM '^session_(.+)$')
      )
    )
  )
);

-- Notifications are authoritative database events. Clients can receive their
-- own private topic but cannot publish to it.
CREATE OR REPLACE FUNCTION public.broadcast_notification_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, realtime
AS $$
BEGIN
  PERFORM realtime.send(
    jsonb_build_object(
      'notification', jsonb_build_object(
        'id', NEW.id,
        'type', NEW.type,
        'title', NEW.title,
        'message', NEW.message,
        'data', NEW.data,
        'is_read', NEW.is_read,
        'created_at', NEW.created_at
      )
    ),
    'notification',
    'notifications_' || NEW.user_id::text,
    true
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_broadcast_notification_insert ON public.notifications;
CREATE TRIGGER trg_broadcast_notification_insert
AFTER INSERT ON public.notifications
FOR EACH ROW EXECUTE FUNCTION public.broadcast_notification_insert();
