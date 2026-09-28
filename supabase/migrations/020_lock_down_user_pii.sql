-- Make public-profile access safe even when a browser has the Supabase public
-- key. RLS continues to decide which rows are visible; these column grants
-- prevent anonymous and authenticated PostgREST clients from selecting email,
-- password_hash, moderation fields, or private metadata.
--
-- The catalog lookup keeps this forward migration compatible with databases
-- where a previously optional profile field was not created.
DO $$
DECLARE
  public_columns TEXT;
BEGIN
  SELECT string_agg(quote_ident(column_name), ', ' ORDER BY ordinal_position)
  INTO public_columns
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'users'
    AND column_name = ANY (ARRAY[
      'id', 'username', 'display_name', 'avatar_url', 'bio', 'role',
      'preferred_broker', 'followers_count', 'following_count', 'created_at'
    ]);

  IF public_columns IS NULL THEN
    RAISE EXCEPTION 'public.users does not contain any approved public-profile columns';
  END IF;

  REVOKE SELECT ON TABLE public.users FROM PUBLIC, anon, authenticated;
  EXECUTE format('GRANT SELECT (%s) ON TABLE public.users TO anon, authenticated', public_columns);
END;
$$;
