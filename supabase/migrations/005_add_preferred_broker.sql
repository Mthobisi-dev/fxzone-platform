-- Migration 005: Add preferred_broker column to public.users table

ALTER TABLE public.users ADD COLUMN IF NOT EXISTS preferred_broker VARCHAR(100) DEFAULT 'Exness';

-- Update database trigger to default preferred_broker to 'Exness' if missing
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    base_username TEXT;
    unique_username TEXT;
    display_name TEXT;
    avatar_url TEXT;
BEGIN
    base_username := COALESCE(
        NEW.raw_user_meta_data->>'username',
        LOWER(REGEXP_REPLACE(COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', SPLIT_PART(NEW.email, '@', 1)), '[^a-zA-Z0-9_]', '', 'g')),
        'trader'
    );
    
    unique_username := base_username || '_' || SUBSTRING(REPLACE(NEW.id::text, '-', ''), 1, 6);
    display_name := COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', base_username);
    avatar_url := COALESCE(NEW.raw_user_meta_data->>'avatar_url', NEW.raw_user_meta_data->>'picture', NULL);

    INSERT INTO public.users (
        id,
        email,
        username,
        display_name,
        avatar_url,
        preferred_broker,
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
        COALESCE(NEW.raw_user_meta_data->>'preferred_broker', 'Exness'),
        'trader'::user_role,
        true,
        NOW(),
        NOW()
    )
    ON CONFLICT (id) DO NOTHING;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
