import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

let clientInstance: SupabaseClient | null = null;

function getSupabaseClient(): SupabaseClient {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      'Supabase client configuration is incomplete. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (or NEXT_PUBLIC_SUPABASE_ANON_KEY).'
    );
  }

  if (!clientInstance) {
    clientInstance = createClient(supabaseUrl, supabaseAnonKey);
  }
  return clientInstance;
}

// Delaying creation keeps `next build` independent of deployment secrets while
// making a missing browser configuration fail immediately at first use.
export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, prop: keyof SupabaseClient) {
    const value = getSupabaseClient()[prop];
    return typeof value === 'function' ? value.bind(getSupabaseClient()) : value;
  },
});

export { supabaseAdmin, getSupabaseAdmin, getSupabaseServerConfig, getUserFromRequest, ensureUserProfile } from './server/supabaseServer';


