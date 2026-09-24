-- ============================================================================
-- 007_optional_lock_down_pii.sql   (OPT-IN — read before applying)
--
-- Problem: the policy "Public profiles are readable by all" (USING true) on
-- public.users lets ANYONE holding the public anon key run
--     GET {SUPABASE_URL}/rest/v1/users?select=email,username
-- and download every user's email address.
--
-- Fix: column-level privileges. anon/authenticated may only read the public
-- profile columns. The service_role key used by Next.js server routes is unaffected.
--
-- WHEN TO APPLY
--   * After every public profile read has been verified against the policies below, OR
--   * after confirming SUPABASE_SERVICE_ROLE_KEY is set for the legacy Next.js
--     API routes. Without it those routes fall back to the anon client and
--     `select('*')` on users (e.g. /api/auth/me) would start failing.
--
-- ROLLBACK
--   GRANT SELECT ON public.users TO anon, authenticated;
-- ============================================================================

REVOKE SELECT ON public.users FROM anon, authenticated;
GRANT SELECT (id, username, display_name, avatar_url, bio, role, is_active, preferred_broker,
              followers_count, following_count, created_at, updated_at)
    ON public.users TO anon, authenticated;
