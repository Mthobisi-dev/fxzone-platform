-- Remove the two explicitly requested Jack accounts from the application and
-- Supabase Auth. This is idempotent and only matches the exact usernames.
-- Related application rows use ON DELETE CASCADE; active Auth sessions are
-- revoked first so cached sessions cannot continue after deletion.

DO $$
DECLARE
  target_ids UUID[];
BEGIN
  SELECT ARRAY_AGG(DISTINCT candidate.id)
  INTO target_ids
  FROM (
    SELECT id
    FROM public.users
    WHERE LOWER(BTRIM(username)) IN ('jack_677d1b', 'jack_dcd66b')

    UNION

    SELECT id
    FROM auth.users
    WHERE LOWER(BTRIM(COALESCE(raw_user_meta_data ->> 'username', ''))) IN ('jack_677d1b', 'jack_dcd66b')
  ) AS candidate;

  IF COALESCE(array_length(target_ids, 1), 0) = 0 THEN
    RETURN;
  END IF;

  DELETE FROM auth.sessions WHERE user_id = ANY(target_ids);
  DELETE FROM public.users WHERE id = ANY(target_ids);
  DELETE FROM auth.users WHERE id = ANY(target_ids);
END $$;
