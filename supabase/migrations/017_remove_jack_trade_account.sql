-- Remove the requested Jack Trade account from the application and Auth.
-- Safe to run repeatedly: no rows are affected after the account is removed.

DO $$
DECLARE
  target_ids UUID[];
BEGIN
  SELECT ARRAY_AGG(DISTINCT candidate.id)
  INTO target_ids
  FROM (
    SELECT id
    FROM public.users
    WHERE LOWER(COALESCE(username, '')) = 'jack_d9e07f'
       OR LOWER(BTRIM(COALESCE(display_name, ''))) = 'jack trade'

    UNION

    SELECT id
    FROM auth.users
    WHERE LOWER(COALESCE(raw_user_meta_data ->> 'username', '')) = 'jack_d9e07f'
       OR LOWER(BTRIM(COALESCE(
            raw_user_meta_data ->> 'display_name',
            raw_user_meta_data ->> 'full_name',
            raw_user_meta_data ->> 'name',
            ''
          ))) = 'jack trade'
  ) AS candidate;

  IF COALESCE(array_length(target_ids, 1), 0) = 0 THEN
    RETURN;
  END IF;

  DELETE FROM auth.sessions WHERE user_id = ANY(target_ids);
  DELETE FROM public.users WHERE id = ANY(target_ids);
  DELETE FROM auth.users WHERE id = ANY(target_ids);
END $$;
