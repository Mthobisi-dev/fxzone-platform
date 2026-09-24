-- Keep session state and viewer counts consistent when several participants
-- leave at the same time. This RPC is called only by authenticated Next.js
-- route handlers using the server service-role key.

CREATE OR REPLACE FUNCTION public.leave_session(p_session_id UUID, p_user_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_session public.live_sessions%ROWTYPE;
    v_participant public.session_participants%ROWTYPE;
    v_viewer_count INT;
BEGIN
    SELECT * INTO v_session
    FROM public.live_sessions
    WHERE id = p_session_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Session not found';
    END IF;

    SELECT * INTO v_participant
    FROM public.session_participants
    WHERE session_id = p_session_id
      AND user_id = p_user_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Session participant not found';
    END IF;

    UPDATE public.session_participants
    SET left_at = NOW()
    WHERE id = v_participant.id;

    IF v_session.host_id = p_user_id THEN
        UPDATE public.live_sessions
        SET status = 'ended', ended_at = NOW(), viewer_count = 0
        WHERE id = p_session_id
        RETURNING * INTO v_session;
    ELSE
        SELECT COUNT(*) INTO v_viewer_count
        FROM public.session_participants
        WHERE session_id = p_session_id
          AND left_at IS NULL
          AND role NOT IN ('pending', 'rejected');

        UPDATE public.live_sessions
        SET viewer_count = v_viewer_count
        WHERE id = p_session_id
        RETURNING * INTO v_session;
    END IF;

    RETURN row_to_json(v_session);
END;
$$;

REVOKE ALL ON FUNCTION public.leave_session(UUID, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.leave_session(UUID, UUID) FROM anon;
REVOKE ALL ON FUNCTION public.leave_session(UUID, UUID) FROM authenticated;
