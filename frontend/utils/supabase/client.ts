import { createBrowserClient } from "@supabase/ssr";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://cxmvfdnckedjvfcqsiiw.supabase.co';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_Ru9GTqf97agSyKMfjA7UMQ_WDza-NY0';

export const createClient = () =>
  createBrowserClient(
    supabaseUrl,
    supabaseKey,
  );
