-- Repair private Realtime authorization for live-session broadcasts.
--
-- Why this exists:
-- Earlier session fixes were split across migrations 009, 019, 021 and a
-- timestamped membership policy. Projects that applied only part of that
-- sequence have valid live_sessions rows but cannot join `session_<uuid>`:
-- Realtime evaluates its RLS policy as the authenticated subscriber, and the
-- membership lookup is hidden without an own-row SELECT policy.
--
-- This migration is intentionally idempotent. It restores the application
-- contract without making session channels public or granting membership
-- writes to browser clients. It does not apply itself to a remote project.

BEGIN;

-- Realtime policy evaluation needs to see only the current subscriber's
-- membership. The server remains responsible for creating, approving, leaving
-- and rejecting memberships through trusted API routes/RPCs.
ALTER TABLE public.session_participants ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.session_participants TO authenticated;
DROP POLICY IF EXISTS fxzone_read_own_session_membership ON public.session_participants;
CREATE POLICY fxzone_read_own_session_membership
ON public.session_participants
FOR SELECT TO authenticated
USING (user_id = (SELECT auth.uid()));

-- Supabase Realtime owns its messages relation. RLS is already enabled there;
-- only policies may be managed. Do not add ALTER TABLE realtime.messages here.
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
        SELECT 1
        FROM public.conversation_members AS member
        WHERE member.user_id = (SELECT auth.uid())
          AND member.conversation_id::text = substring(realtime.topic() FROM '^chat_(.+)$')
      )
    )
    OR (
      realtime.topic() LIKE 'session_%'
      AND EXISTS (
        SELECT 1
        FROM public.session_participants AS participant
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
        SELECT 1
        FROM public.conversation_members AS member
        WHERE member.user_id = (SELECT auth.uid())
          AND member.conversation_id::text = substring(realtime.topic() FROM '^chat_(.+)$')
      )
    )
    OR (
      realtime.topic() LIKE 'session_%'
      AND EXISTS (
        SELECT 1
        FROM public.session_participants AS participant
        WHERE participant.user_id = (SELECT auth.uid())
          AND participant.left_at IS NULL
          AND participant.role IN ('host', 'viewer')
          AND participant.session_id::text = substring(realtime.topic() FROM '^session_(.+)$')
      )
    )
  )
);

-- Recreate the host-review function for projects that missed migration 009.
-- It is only executable by service_role after the Next.js route verifies the
-- host's bearer token; never expose this SECURITY DEFINER function to clients.
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

    SELECT * INTO v_session
    FROM public.live_sessions
    WHERE id = p_session_id
    FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Session not found'; END IF;
    IF v_session.host_id <> p_host_id THEN RAISE EXCEPTION 'Only the host can review participants'; END IF;
    IF v_session.status = 'ended' THEN RAISE EXCEPTION 'Session has already ended'; END IF;

    SELECT * INTO v_participant
    FROM public.session_participants
    WHERE session_id = p_session_id AND user_id = p_user_id
    FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Session participant not found'; END IF;
    IF v_participant.role <> 'pending' THEN RAISE EXCEPTION 'Participant is not awaiting approval'; END IF;

    IF p_decision = 'approve' THEN
        SELECT COUNT(*) INTO v_active_count
        FROM public.session_participants
        WHERE session_id = p_session_id
          AND left_at IS NULL
          AND role NOT IN ('pending', 'rejected');
        IF v_session.max_participants IS NOT NULL
           AND v_active_count >= v_session.max_participants THEN
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
    WHERE session_id = p_session_id
      AND left_at IS NULL
      AND role NOT IN ('pending', 'rejected');
    UPDATE public.live_sessions
    SET viewer_count = v_active_count
    WHERE id = p_session_id;

    RETURN row_to_json(v_participant);
END;
$$;

-- Preserve an approval decision when the waiting room polls. A repeated join
-- must never downgrade an approved viewer back to pending and revoke Realtime.
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
    IF NOT FOUND THEN RAISE EXCEPTION 'Session not found'; END IF;
    IF v_session.status = 'ended' THEN RAISE EXCEPTION 'Session has already ended'; END IF;

    SELECT * INTO v_participant
    FROM public.session_participants
    WHERE session_id = p_session_id AND user_id = p_user_id
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
    DO UPDATE SET role = EXCLUDED.role, joined_at = NOW(), left_at = NULL
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

REVOKE ALL ON FUNCTION public.review_session_participant(UUID, UUID, UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.review_session_participant(UUID, UUID, UUID, TEXT) FROM anon;
REVOKE ALL ON FUNCTION public.review_session_participant(UUID, UUID, UUID, TEXT) FROM authenticated;
REVOKE ALL ON FUNCTION public.join_session(UUID, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.join_session(UUID, UUID) FROM anon;
REVOKE ALL ON FUNCTION public.join_session(UUID, UUID) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.review_session_participant(UUID, UUID, UUID, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.join_session(UUID, UUID) TO service_role;

COMMIT;
