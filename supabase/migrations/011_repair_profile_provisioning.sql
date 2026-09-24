-- Repair public.users provisioning for Supabase Auth users.
-- Safe to run after the earlier migrations and on installations that still
-- retain the legacy NOT NULL password_hash column.

ALTER TABLE public.users ALTER COLUMN password_hash DROP NOT NULL;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  base_username TEXT;
  unique_username TEXT;
BEGIN
  base_username := COALESCE(
    NEW.raw_user_meta_data->>'username',
    LOWER(REGEXP_REPLACE(COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', SPLIT_PART(NEW.email, '@', 1)), '[^a-zA-Z0-9_]', '', 'g')),
    'trader'
  );
  base_username := COALESCE(NULLIF(LEFT(base_username, 42), ''), 'trader');
  unique_username := base_username || '_' || SUBSTRING(REPLACE(NEW.id::text, '-', ''), 1, 6);

  INSERT INTO public.users (
    id, email, username, password_hash, display_name, avatar_url, role, is_active, created_at, updated_at
  ) VALUES (
    NEW.id,
    COALESCE(NEW.email, NEW.id::text || '@fxzone.local'),
    unique_username,
    '',
    COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', base_username),
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', NEW.raw_user_meta_data->>'picture'),
    'trader'::user_role,
    true,
    NOW(),
    NOW()
  ) ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
