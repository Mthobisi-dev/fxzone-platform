-- Remove the inaccessible account explicitly requested by its display name.
-- Idempotent: no operation occurs if the account was already removed.
DO $$
DECLARE
  target_ids UUID[];
BEGIN
  SELECT ARRAY_AGG(DISTINCT candidate.id) INTO target_ids
  FROM (
    SELECT id FROM public.users WHERE LOWER(BTRIM(display_name)) = 'mthobisi mzimela'
    UNION
    SELECT id FROM auth.users
    WHERE LOWER(BTRIM(COALESCE(raw_user_meta_data ->> 'display_name', raw_user_meta_data ->> 'full_name', ''))) = 'mthobisi mzimela'
  ) AS candidate;

  IF COALESCE(array_length(target_ids, 1), 0) = 0 THEN RETURN; END IF;
  DELETE FROM auth.sessions WHERE user_id = ANY(target_ids);
  DELETE FROM public.users WHERE id = ANY(target_ids);
  DELETE FROM auth.users WHERE id = ANY(target_ids);
END $$;
