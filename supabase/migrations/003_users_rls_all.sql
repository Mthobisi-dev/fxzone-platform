-- Grant authenticated users full INSERT and UPDATE RLS access on public.users
-- This guarantees profile provisioning succeeds even when using the anon client.

DO $$
BEGIN
    -- 1. Ensure INSERT policy exists
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'users' AND policyname = 'Users can insert own profile'
    ) THEN
        CREATE POLICY "Users can insert own profile" ON users FOR INSERT WITH CHECK (auth.uid() = id);
    END IF;

    -- 2. Ensure UPDATE policy exists (required for UPSERT)
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'users' AND policyname = 'Users can update own profile'
    ) THEN
        CREATE POLICY "Users can update own profile" ON users FOR UPDATE USING (auth.uid() = id);
    END IF;

    -- 3. Ensure SELECT policy exists
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'users' AND policyname = 'Users can select profiles'
    ) THEN
        CREATE POLICY "Users can select profiles" ON users FOR SELECT USING (true);
    END IF;
END $$;
