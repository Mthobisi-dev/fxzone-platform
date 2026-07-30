import { createClient } from '@supabase/supabase-js';

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://jimbcgbhjkahnljpijqy.supabase.co';
const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_nz1mP7vRhXd5ExR402xB-g_zY_g57yi';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
