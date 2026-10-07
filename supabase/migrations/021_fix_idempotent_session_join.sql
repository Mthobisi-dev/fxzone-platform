-- Keep live-session admission stable across page refreshes and approval polling.
--
-- `join_session` is invoked more than once by the waiting-room page. The prior
-- implementation recalculated an existing approved viewer as `pending` whenever
-- a session required approval, which removed their Realtime authorization just
-- after a host approved them. Existing active and rejected decisions must be
-- returned unchanged; only a new or previously-left participant is admitted.

CREATE OR REPLACE FUNCTION public.join_session(p_session_id UUID, p_user_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_session public.live_sessions%ROWTYPE;
    v_participant public.session_participants%ROWTYPE;
    v_role participant_role;
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

    -- Lock an existing membership before deciding admission. A waiting client
    -- may safely call this function repeatedly without losing host approval.
    SELECT * INTO v_participant
    FROM public.session_participants
    WHERE session_id = p_session_id
      AND user_id = p_user_id
    FOR UPDATE;

    IF FOUND THEN
        IF v_participant.role = 'rejected'
           OR (v_participant.left_at IS NULL AND v_participant.role IN ('host', 'viewer', 'pending')) THEN
            RETURN row_to_json(v_participant);
        END IF;
    END IF;

    IF v_session.host_id = p_user_id THEN
        v_role := 'host';
    ELSIF v_session.requires_approval THEN
        v_role := 'pending';
    ELSE
        v_role := 'viewer';
    END IF;

    SELECT COUNT(*) INTO v_active_count
    FROM public.session_participants
    WHERE session_id = p_session_id
      AND left_at IS NULL
      AND role NOT IN ('pending', 'rejected');

    IF v_session.max_participants IS NOT NULL
       AND v_active_count >= v_session.max_participants
       AND v_role NOT IN ('host', 'pending') THEN
        RAISE EXCEPTION 'Session is at full capacity';
    END IF;

    INSERT INTO public.session_participants (session_id, user_id, role, joined_at, left_at)
    VALUES (p_session_id, p_user_id, v_role, NOW(), NULL)
    ON CONFLICT (session_id, user_id)
    DO UPDATE SET
        role = EXCLUDED.role,
        joined_at = NOW(),
        left_at = NULL
    RETURNING * INTO v_participant;

    UPDATE public.live_sessions
    SET viewer_count = (
        SELECT COUNT(*)
        FROM public.session_participants
        WHERE session_id = p_session_id
          AND left_at IS NULL
          AND role NOT IN ('pending', 'rejected')
    )
    WHERE id = p_session_id;

    RETURN row_to_json(v_participant);
END;
$$;

-- This function is called only by authenticated Next.js route handlers using
-- the service role after validating the caller's bearer token.
REVOKE ALL ON FUNCTION public.join_session(UUID, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.join_session(UUID, UUID) FROM anon;
REVOKE ALL ON FUNCTION public.join_session(UUID, UUID) FROM authenticated;
