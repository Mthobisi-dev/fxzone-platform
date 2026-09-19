import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || 'https://placeholder-project.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || 'placeholder-anon-key';

let adminClientInstance: SupabaseClient | null = null;

export function getSupabaseAdmin(request?: Request): SupabaseClient {
  // Use service role key if configured (bypasses RLS for server administration)
  if (supabaseServiceKey) {
    if (!adminClientInstance) {
      adminClientInstance = createClient(supabaseUrl, supabaseServiceKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      });
    }
    return adminClientInstance;
  }

  // Fallback to anon key with request Authorization header if present to satisfy RLS auth.uid()
  const authHeader = request?.headers.get('authorization');
  const headers: Record<string, string> = {};
  if (authHeader) {
    headers['Authorization'] = authHeader;
  }

  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers },
  });
}

// Lazy proxy for backward compatibility
export const supabaseAdmin = new Proxy({} as SupabaseClient, {
  get(_target, prop: keyof SupabaseClient) {
    const client = getSupabaseAdmin();
    const value = client[prop];
    if (typeof value === 'function') {
      return value.bind(client);
    }
    return value;
  },
});

export interface UserFromRequestResult {
  user: any | null;
  role: string | null;
  error: string | null;
}

/**
 * Provisions a public.users profile row for a Supabase Auth user.
 *
 * Uses the service-role admin client (or authenticated anon client) to ensure
 * the profile row exists.
 *
 * Returns true if the profile row is confirmed to exist after the call,
 * false if provisioning failed AND the row is missing.
 */
export async function ensureUserProfile(
  _client: SupabaseClient, // kept for API compat; we always use admin internally
  user: any
): Promise<boolean> {
  if (!user || !user.id) return false;

  const adminDb = getSupabaseAdmin();

  try {
    // 1. Check existence first (cheap primary-key lookup)
    const { data: existing } = await adminDb
      .from('users')
      .select('id')
      .eq('id', user.id)
      .maybeSingle();

    if (existing) return true; // Already exists — fast path

    // 2. Row is missing — build profile payload
    const meta = user.user_metadata || {};
    const baseUsername =
      meta.username ||
      meta.name?.replace(/\s+/g, '_').toLowerCase() ||
      user.email?.split('@')[0] ||
      'trader';

    const uniqueUsername = `${baseUsername}_${user.id.replace(/[^a-zA-Z0-9]/g, '').substring(0, 6)}`;
    const displayName = meta.display_name || meta.full_name || meta.name || baseUsername;
    const role = meta.role || 'trader';
    const avatarUrl = meta.avatar_url || meta.picture || null;
    const bio = meta.bio || '';

    const payload = {
      id: user.id,
      email: user.email || `${user.id}@fxzone.local`,
      username: uniqueUsername,
      password_hash: 'SUPABASE_AUTH_MANAGED',
      display_name: displayName,
      avatar_url: avatarUrl,
      bio,
      role,
      created_at: user.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // 3. Attempt UPSERT first
    const { error: upsertErr } = await adminDb
      .from('users')
      .upsert(payload, { onConflict: 'id', ignoreDuplicates: false });

    if (upsertErr) {
      // If UPSERT is blocked by RLS, attempt plain INSERT
      const { error: insertErr } = await adminDb
        .from('users')
        .insert(payload);

      if (insertErr) {
        // Attempt UPDATE in case row partially exists
        await adminDb.from('users').update({
          display_name: displayName,
          avatar_url: avatarUrl,
          updated_at: new Date().toISOString(),
        }).eq('id', user.id);
      }
    }

    // 4. Verify the row actually landed (confirms FK safety)
    const { data: confirmed } = await adminDb
      .from('users')
      .select('id')
      .eq('id', user.id)
      .maybeSingle();

    if (!confirmed) {
      return false;
    }

    return true;
  } catch (err: any) {
    return false;
  }
}

/**
 * Authenticates a request and returns the user + role in minimal DB round-trips.
 */
export async function getUserFromRequest(request: Request): Promise<UserFromRequestResult> {
  const authHeader = request.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { user: null, role: null, error: 'Missing or invalid Authorization header' };
  }

  const token = authHeader.replace('Bearer ', '').trim();
  if (!token) {
    return { user: null, role: null, error: 'Empty bearer token' };
  }

  try {
    const client = getSupabaseAdmin(request);

    // Step 1: Verify the JWT and decode user identity (1 network call)
    const { data: { user }, error } = await client.auth.getUser(token);

    if (error || !user) {
      return { user: null, role: null, error: error?.message || 'Invalid authentication token' };
    }

    // Step 2: Fetch profile row for role — single, cheap SELECT on primary key
    const { data: profile } = await client
      .from('users')
      .select('id, role')
      .eq('id', user.id)
      .maybeSingle();

    let role = 'trader';

    if (profile) {
      // Profile exists — use DB role (authoritative)
      role = profile.role || 'trader';
    } else {
      // Profile does NOT exist — provision it asynchronously (non-blocking)
      role = user.user_metadata?.role || 'trader';
      ensureUserProfile(client, user).catch(() => {});
    }

    return { user, role, error: null };
  } catch (err: any) {
    return { user: null, role: null, error: err.message || 'Authentication error' };
  }
}
