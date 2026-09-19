-- Migration 004: Drop NOT NULL constraint on users.password_hash & install automated profile trigger

-- 1. Make password_hash nullable (Supabase Auth manages actual authentication credentials)
ALTER TABLE public.users ALTER COLUMN password_hash DROP NOT NULL;

-- 2. Create authoritative database trigger for automatic user profile provisioning
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    base_username TEXT;
    unique_username TEXT;
    display_name TEXT;
    avatar_url TEXT;
BEGIN
    -- Derive base username from metadata or email
    base_username := COALESCE(
        NEW.raw_user_meta_data->>'username',
        LOWER(REGEXP_REPLACE(COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', SPLIT_PART(NEW.email, '@', 1)), '[^a-zA-Z0-9_]', '', 'g')),
        'trader'
    );
    
    -- Guarantee username uniqueness by appending short UUID suffix
    unique_username := base_username || '_' || SUBSTRING(REPLACE(NEW.id::text, '-', ''), 1, 6);
    display_name := COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', base_username);
    avatar_url := COALESCE(NEW.raw_user_meta_data->>'avatar_url', NEW.raw_user_meta_data->>'picture', NULL);

    -- Insert profile row with mandatory role = 'trader' (prevents client-side role escalation)
    INSERT INTO public.users (
        id,
        email,
        username,
        display_name,
        avatar_url,
        role,
        is_active,
        created_at,
        updated_at
    ) VALUES (
        NEW.id,
        COALESCE(NEW.email, NEW.id::text || '@fxzone.local'),
        unique_username,
        display_name,
        avatar_url,
        'trader'::user_role,
        true,
        NOW(),
        NOW()
    )
    ON CONFLICT (id) DO NOTHING;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Bind trigger to auth.users ON INSERT
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
