-- Remove the specifically requested account from both application profiles and Supabase Auth.
-- The exact normalized username prevents matching similarly named accounts.
-- This is idempotent: it does nothing if the account is already absent.

DO $$
DECLARE
  target_ids UUID[];
BEGIN
  SELECT ARRAY_AGG(DISTINCT candidate.id)
  INTO target_ids
  FROM (
    SELECT id
    FROM public.users
    WHERE LOWER(username) = 'jack_d9e07f'

    UNION

    SELECT id
    FROM auth.users
    WHERE LOWER(COALESCE(raw_user_meta_data ->> 'username', '')) = 'jack_d9e07f'
  ) AS candidate;

  IF COALESCE(array_length(target_ids, 1), 0) = 0 THEN
    RETURN;
  END IF;

  -- End current sessions first so a cached access token cannot continue a session.
  DELETE FROM auth.sessions WHERE user_id = ANY(target_ids);

  -- Application tables reference public.users with ON DELETE CASCADE.
  DELETE FROM public.users WHERE id = ANY(target_ids);
  DELETE FROM auth.users WHERE id = ANY(target_ids);
END $$;