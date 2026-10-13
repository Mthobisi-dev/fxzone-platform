-- Forward-only repair for projects that have an incomplete live-session
-- migration history. Admission is follower-gated and host-approved; only an
-- approved viewer or the host may use session_<uuid> private Realtime topics.
-- Supabase owns realtime.messages, so this migration only manages policies.

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

ALTER TABLE public.session_participants ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.session_participants TO authenticated;
DROP POLICY IF EXISTS fxzone_read_own_session_membership ON public.session_participants;
CREATE POLICY fxzone_read_own_session_membership
ON public.session_participants
FOR SELECT TO authenticated
USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS fxzone_realtime_private_read ON realtime.messages;
DROP POLICY IF EXISTS fxzone_realtime_private_write ON realtime.messages;

CREATE POLICY fxzone_realtime_private_read
ON realtime.messages
FOR SELECT TO authenticated
USING (
  realtime.messages.extension IN ('broadcast', 'presence')
  AND (
    (
      realtime.topic() LIKE 'chat_%'
      AND EXISTS (
        SELECT 1 FROM public.conversation_members AS member
        WHERE member.user_id = (SELECT auth.uid())
          AND member.conversation_id::text = substring(realtime.topic() FROM '^chat_(.+)$')
      )
    )
    OR (
      realtime.topic() LIKE 'session_%'
      AND EXISTS (
        SELECT 1 FROM public.session_participants AS participant
        WHERE participant.user_id = (SELECT auth.uid())
          AND participant.left_at IS NULL
          AND participant.role IN ('host', 'viewer')
          AND participant.session_id::text = substring(realtime.topic() FROM '^session_(.+)$')
      )
    )
    OR realtime.topic() = ('notifications_' || (SELECT auth.uid())::text)
  )
);

CREATE POLICY fxzone_realtime_private_write
ON realtime.messages
FOR INSERT TO authenticated
WITH CHECK (
  realtime.messages.extension IN ('broadcast', 'presence')
  AND (
    (
      realtime.topic() LIKE 'chat_%'
      AND EXISTS (
        SELECT 1 FROM public.conversation_members AS member
        WHERE member.user_id = (SELECT auth.uid())
          AND member.conversation_id::text = substring(realtime.topic() FROM '^chat_(.+)$')
      )
    )
    OR (
      realtime.topic() LIKE 'session_%'
      AND EXISTS (
        SELECT 1 FROM public.session_participants AS participant
        WHERE participant.user_id = (SELECT auth.uid())
          AND participant.left_at IS NULL
          AND participant.role IN ('host', 'viewer')
          AND participant.session_id::text = substring(realtime.topic() FROM '^session_(.+)$')
      )
    )
  )
);

CREATE OR REPLACE FUNCTION public.review_session_participant(
  p_session_id UUID,
  p_host_id UUID,
  p_user_id UUID,
  p_decision TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_session public.live_sessions%ROWTYPE;
  v_participant public.session_participants%ROWTYPE;
  v_active_count INT;
BEGIN
  IF p_decision NOT IN ('approve', 'reject') THEN
    RAISE EXCEPTION 'Invalid participant review decision';
  END IF;

  SELECT * INTO v_session FROM public.live_sessions WHERE id = p_session_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Session not found'; END IF;
  IF v_session.host_id <> p_host_id THEN
    RAISE EXCEPTION 'Only the host can review participants' USING ERRCODE = '42501';
  END IF;
  IF v_session.status = 'ended' THEN RAISE EXCEPTION 'Session has already ended'; END IF;

  SELECT * INTO v_participant
  FROM public.session_participants
  WHERE session_id = p_session_id AND user_id = p_user_id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Session participant not found'; END IF;
  IF v_participant.role <> 'pending' OR v_participant.left_at IS NOT NULL THEN
    RAISE EXCEPTION 'Participant is not awaiting approval';
  END IF;

  IF p_decision = 'approve' THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.follows AS follow_relation
      WHERE follow_relation.follower_id = p_user_id
        AND follow_relation.following_id = v_session.host_id
    ) THEN
      RAISE EXCEPTION 'Participant no longer follows the host' USING ERRCODE = '42501';
    END IF;

    SELECT COUNT(*) INTO v_active_count
    FROM public.session_participants
    WHERE session_id = p_session_id AND left_at IS NULL AND role NOT IN ('pending', 'rejected');
    IF v_session.max_participants IS NOT NULL AND v_active_count >= v_session.max_participants THEN
      RAISE EXCEPTION 'Session is at full capacity';
    END IF;

    UPDATE public.session_participants
    SET role = 'viewer', left_at = NULL, joined_at = NOW()
    WHERE id = v_participant.id
    RETURNING * INTO v_participant;
  ELSE
    UPDATE public.session_participants
    SET role = 'rejected', left_at = NOW()
    WHERE id = v_participant.id
    RETURNING * INTO v_participant;
  END IF;

  SELECT COUNT(*) INTO v_active_count
  FROM public.session_participants
  WHERE session_id = p_session_id AND left_at IS NULL AND role NOT IN ('pending', 'rejected');
  UPDATE public.live_sessions SET viewer_count = v_active_count WHERE id = p_session_id;
  RETURN row_to_json(v_participant);
END;
$$;

CREATE OR REPLACE FUNCTION public.join_session(p_session_id UUID, p_user_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_session public.live_sessions%ROWTYPE;
  v_participant public.session_participants%ROWTYPE;
  v_role public.participant_role;
  v_active_count INT;
BEGIN
  SELECT * INTO v_session FROM public.live_sessions WHERE id = p_session_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Session not found'; END IF;
  IF v_session.status = 'ended' THEN RAISE EXCEPTION 'Session has already ended'; END IF;

  SELECT * INTO v_participant
  FROM public.session_participants
  WHERE session_id = p_session_id AND user_id = p_user_id
  FOR UPDATE;
  IF FOUND AND (
    v_participant.role = 'rejected'
    OR (v_participant.left_at IS NULL AND v_participant.role IN ('host', 'viewer', 'pending'))
  ) THEN
    RETURN row_to_json(v_participant);
  END IF;

  IF v_session.host_id = p_user_id THEN
    v_role := 'host';
  ELSE
    IF NOT EXISTS (
      SELECT 1 FROM public.follows AS follow_relation
      WHERE follow_relation.follower_id = p_user_id
        AND follow_relation.following_id = v_session.host_id
    ) THEN
      RAISE EXCEPTION 'Follow the host before requesting access' USING ERRCODE = '42501';
    END IF;
    v_role := 'pending';
  END IF;

  INSERT INTO public.session_participants (session_id, user_id, role, joined_at, left_at)
  VALUES (p_session_id, p_user_id, v_role, NOW(), NULL)
  ON CONFLICT (session_id, user_id)
  DO UPDATE SET role = EXCLUDED.role, joined_at = NOW(), left_at = NULL
  RETURNING * INTO v_participant;

  SELECT COUNT(*) INTO v_active_count
  FROM public.session_participants
  WHERE session_id = p_session_id AND left_at IS NULL AND role NOT IN ('pending', 'rejected');
  UPDATE public.live_sessions SET viewer_count = v_active_count WHERE id = p_session_id;
  RETURN row_to_json(v_participant);
END;
$$;

REVOKE ALL ON FUNCTION public.review_session_participant(UUID, UUID, UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.review_session_participant(UUID, UUID, UUID, TEXT) FROM anon;
REVOKE ALL ON FUNCTION public.review_session_participant(UUID, UUID, UUID, TEXT) FROM authenticated;
REVOKE ALL ON FUNCTION public.join_session(UUID, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.join_session(UUID, UUID) FROM anon;
REVOKE ALL ON FUNCTION public.join_session(UUID, UUID) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.review_session_participant(UUID, UUID, UUID, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.join_session(UUID, UUID) TO service_role;

COMMIT;
