-- A host is never subject to the follower approval workflow.  Earlier versions
-- returned an existing pending membership before comparing the caller with the
-- session host, which could leave a host permanently waiting for approval.
BEGIN;

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
  SELECT * INTO v_session
  FROM public.live_sessions
  WHERE id = p_session_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Session not found';
  END IF;

  IF v_session.status = 'ended' THEN
    RAISE EXCEPTION 'Session has already ended';
  END IF;

  SELECT * INTO v_participant
  FROM public.session_participants
  WHERE session_id = p_session_id
    AND user_id = p_user_id
  FOR UPDATE;

  -- Resolve the host before returning an existing membership. This repairs a
  -- stale pending, rejected, viewer, or departed participant row for the host.
  IF v_session.host_id = p_user_id THEN
    IF FOUND
      AND v_participant.role = 'host'
      AND v_participant.left_at IS NULL THEN
      RETURN row_to_json(v_participant);
    END IF;

    v_role := 'host';
  ELSE
    -- A follower's existing approved/pending/rejected decision remains stable.
    IF FOUND AND (
      v_participant.role = 'rejected'
      OR (v_participant.left_at IS NULL AND v_participant.role IN ('host', 'viewer', 'pending'))
    ) THEN
      RETURN row_to_json(v_participant);
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM public.follows AS follow_relation
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
  DO UPDATE SET
    role = EXCLUDED.role,
    joined_at = NOW(),
    left_at = NULL
  RETURNING * INTO v_participant;

  SELECT COUNT(*) INTO v_active_count
  FROM public.session_participants
  WHERE session_id = p_session_id
    AND left_at IS NULL
    AND role NOT IN ('pending', 'rejected');

  UPDATE public.live_sessions
  SET viewer_count = v_active_count
  WHERE id = p_session_id;

  RETURN row_to_json(v_participant);
END;
$$;

REVOKE ALL ON FUNCTION public.join_session(UUID, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.join_session(UUID, UUID) FROM anon;
REVOKE ALL ON FUNCTION public.join_session(UUID, UUID) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.join_session(UUID, UUID) TO service_role;

COMMIT;
