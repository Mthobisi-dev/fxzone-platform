-- Make pre-existing Supabase Auth accounts visible in Discover.
-- This is idempotent: existing public profiles are left unchanged.

ALTER TABLE public.users ALTER COLUMN password_hash DROP NOT NULL;

INSERT INTO public.users (
  id, email, username, password_hash, display_name, avatar_url, role, is_active, created_at, updated_at
)
SELECT
  auth_user.id,
  COALESCE(auth_user.email, auth_user.id::text || '@fxzone.local'),
  COALESCE(NULLIF(LEFT(
    COALESCE(
      auth_user.raw_user_meta_data->>'username',
      LOWER(REGEXP_REPLACE(COALESCE(auth_user.raw_user_meta_data->>'full_name', auth_user.raw_user_meta_data->>'name', SPLIT_PART(auth_user.email, '@', 1)), '[^a-zA-Z0-9_]', '', 'g')),
      'trader'
    ), 42), ''), 'trader') || '_' || SUBSTRING(REPLACE(auth_user.id::text, '-', ''), 1, 6),
  '',
  COALESCE(auth_user.raw_user_meta_data->>'display_name', auth_user.raw_user_meta_data->>'full_name', auth_user.raw_user_meta_data->>'name', SPLIT_PART(COALESCE(auth_user.email, 'Trader'), '@', 1)),
  COALESCE(auth_user.raw_user_meta_data->>'avatar_url', auth_user.raw_user_meta_data->>'picture'),
  'trader'::user_role,
  true,
  COALESCE(auth_user.created_at, NOW()),
  NOW()
FROM auth.users AS auth_user
LEFT JOIN public.users AS profile ON profile.id = auth_user.id
WHERE profile.id IS NULL
ON CONFLICT (id) DO NOTHING;
