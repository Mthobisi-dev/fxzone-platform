import { createClient } from '@supabase/supabase-js';

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://cxmvfdnckedjvfcqsiiw.supabase.co';
const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_Ru9GTqf97agSyKMfjA7UMQ_WDza-NY0';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
