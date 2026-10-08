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
-- Be explicit about privileged RPC access instead of depending on each
-- project's default function privileges.
GRANT EXECUTE ON FUNCTION public.join_session(UUID, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.leave_session(UUID, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.review_session_participant(UUID, UUID, UUID, TEXT) TO service_role;

COMMIT;
