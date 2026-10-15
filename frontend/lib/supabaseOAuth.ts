import { createBrowserClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabasePublishableKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

let oauthClient: SupabaseClient | null = null;

/**
 * Cookie-backed browser client used only for OAuth PKCE handshakes.
 *
 * The application's existing client continues to own the normal browser
 * session. Keeping the verifier in an HTTP cookie lets it survive Google's
 * redirect reliably, including browsers that isolate or clear page storage.
 */
export function getOAuthSupabaseClient(): SupabaseClient {
  if (!supabaseUrl || !supabasePublishableKey) {
    throw new Error(
      'Supabase OAuth configuration is incomplete. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.'
    );
  }

  if (!oauthClient) {
    oauthClient = createBrowserClient(supabaseUrl, supabasePublishableKey, {
      isSingleton: true,
      auth: {
        flowType: 'pkce',
        detectSessionInUrl: false,
        persistSession: true,
        autoRefreshToken: true,
      },
    });
  }

  return oauthClient;
}
