-- Run AFTER the schema + migrations. Mirrors Supabase's default table grants.
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated;
