-- Apply after 019 and 021. Review and run manually; no production execution
-- is performed by this repository change.
--
-- 019 queries session_participants as the authenticated subscriber. The base
-- schema enables RLS on that table but defines no SELECT policy, so EXISTS
-- evaluates to false even for a host/approved viewer. Service-role REST calls
-- bypass RLS and therefore masked this problem when checking room admission.
BEGIN;

ALTER TABLE public.session_participants ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.session_participants TO authenticated;
DROP POLICY IF EXISTS fxzone_read_own_session_membership ON public.session_participants;
CREATE POLICY fxzone_read_own_session_membership
ON public.session_participants
FOR SELECT TO authenticated
USING (user_id = (SELECT auth.uid()));

-- This grants no client membership writes. Only the host's authenticated
-- server route can approve participants. Migration 019 still excludes pending,
-- rejected and departed participants from receiving/sending session broadcasts.
-- Some existing projects applied the base/session migrations but missed 009.
-- The approval API depends on this function, so create it idempotently here
-- rather than failing this RLS migration with an unconditional GRANT.
CREATE OR REPLACE FUNCTION public.review_session_participant(
    p_session_id UUID,
    p_host_id UUID,
    p_user_id UUID,
    p_decision TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_session public.live_sessions%ROWTYPE;
    v_participant public.session_participants%ROWTYPE;
    v_active_count INT;
BEGIN
    IF p_decision NOT IN ('approve', 'reject') THEN
        RAISE EXCEPTION 'Invalid participant review decision';
    END IF;

    SELECT * INTO v_session FROM public.live_sessions
    WHERE id = p_session_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Session not found'; END IF;
    IF v_session.host_id <> p_host_id THEN RAISE EXCEPTION 'Only the host can review participants'; END IF;
    IF v_session.status = 'ended' THEN RAISE EXCEPTION 'Session has already ended'; END IF;

    SELECT * INTO v_participant FROM public.session_participants
    WHERE session_id = p_session_id AND user_id = p_user_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Session participant not found'; END IF;
    IF v_participant.role <> 'pending' THEN RAISE EXCEPTION 'Participant is not awaiting approval'; END IF;

    IF p_decision = 'approve' THEN
        SELECT COUNT(*) INTO v_active_count FROM public.session_participants
        WHERE session_id = p_session_id AND left_at IS NULL
          AND role NOT IN ('pending', 'rejected');
        IF v_session.max_participants IS NOT NULL
           AND v_active_count >= v_session.max_participants THEN
            RAISE EXCEPTION 'Session is at full capacity';
        END IF;
        UPDATE public.session_participants
        SET role = 'viewer', left_at = NULL, joined_at = NOW()
        WHERE id = v_participant.id RETURNING * INTO v_participant;
    ELSE
        UPDATE public.session_participants
        SET role = 'rejected', left_at = NOW()
        WHERE id = v_participant.id RETURNING * INTO v_participant;
    END IF;

    SELECT COUNT(*) INTO v_active_count FROM public.session_participants
    WHERE session_id = p_session_id AND left_at IS NULL
      AND role NOT IN ('pending', 'rejected');
    UPDATE public.live_sessions SET viewer_count = v_active_count
    WHERE id = p_session_id;

    RETURN row_to_json(v_participant);
END;
$$;

REVOKE ALL ON FUNCTION public.review_session_participant(UUID, UUID, UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.review_session_participant(UUID, UUID, UUID, TEXT) FROM anon;
REVOKE ALL ON FUNCTION public.review_session_participant(UUID, UUID, UUID, TEXT) FROM authenticated;

-- Be explicit about privileged RPC access instead of depending on each
-- project's default function privileges. Legacy projects can be missing the
-- optional leave/join RPCs, so grant only signatures that actually exist.
DO $$
BEGIN
    IF to_regprocedure('public.join_session(uuid,uuid)') IS NOT NULL THEN
        GRANT EXECUTE ON FUNCTION public.join_session(UUID, UUID) TO service_role;
    END IF;
    IF to_regprocedure('public.leave_session(uuid,uuid)') IS NOT NULL THEN
        GRANT EXECUTE ON FUNCTION public.leave_session(UUID, UUID) TO service_role;
    END IF;
END;
$$;
GRANT EXECUTE ON FUNCTION public.review_session_participant(UUID, UUID, UUID, TEXT) TO service_role;

COMMIT;
