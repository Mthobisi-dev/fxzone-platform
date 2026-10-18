import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseBrowserClient } from './supabaseOAuth';

// Delaying creation keeps `next build` independent of deployment secrets while
// making a missing browser configuration fail immediately at first use.
export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, prop: keyof SupabaseClient) {
    const client = getSupabaseBrowserClient();
    const value = client[prop];
    return typeof value === 'function' ? value.bind(client) : value;
  },
});

export { supabaseAdmin, getSupabaseAdmin, getSupabaseServerConfig, getUserFromRequest, ensureUserProfile, syncAuthProfiles } from './server/supabaseServer';


