import { createClient, SupabaseClient } from '@supabase/supabase-js';

function firstConfiguredEnv(...names: string[]): string {
  for (const name of names) {
    const value = process.env[name]?.trim();
    if (value) return value;
  }
  return '';
}

export function getSupabaseServerConfig() {
  const url = firstConfiguredEnv(
    'NEXT_PUBLIC_SUPABASE_URL',
    'SUPABASE_URL',
    'SUPABASE_PROJECT_URL'
  );
  const serviceKey = firstConfiguredEnv(
    'SUPABASE_SERVICE_ROLE_KEY',
    // Supabase's current secret-key name and a common hosting alias.
    'SUPABASE_SECRET_KEY',
    'SUPABASE_SERVICE_KEY'
  );

  return {
    url,
    serviceKey,
    missing: [
      ...(url ? [] : ['Supabase URL']),
      ...(serviceKey ? [] : ['Supabase server key']),
    ],
  };
}

let adminClientInstance: SupabaseClient | null = null;

export function getSupabaseAdmin(_request?: Request): SupabaseClient {
  const { url, serviceKey, missing } = getSupabaseServerConfig();
  if (missing.length > 0) {
    throw new Error(
      `Supabase server configuration is incomplete: missing ${missing.join(' and ')}.`
    );
  }

  if (!adminClientInstance) {
    adminClientInstance = createClient(url, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }
  return adminClientInstance;
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

type CachedProfile = { role: string; isActive: boolean; expiresAt: number };
const profileCache = new Map<string, CachedProfile>();
const PROFILE_CACHE_TTL_MS = 10_000;

async function getVerifiedProfile(client: SupabaseClient, userId: string) {
  const cached = profileCache.get(userId);
  if (cached && cached.expiresAt > Date.now()) return cached;

  let { data, error } = await client
    .from('users')
    .select('id, role, is_active')
    .eq('id', userId)
    .maybeSingle();

  // Support projects whose migrations have not added is_active yet.
  if (error && (error.code === 'PGRST204' || /is_active.*column|column.*is_active/i.test(error.message || ''))) {
    ({ data, error } = await client.from('users').select('id, role').eq('id', userId).maybeSingle());
  }
  if (error || !data) return null;

  const profile = {
    role: typeof data.role === 'string' ? data.role : 'trader',
    isActive: data.is_active !== false,
    expiresAt: Date.now() + PROFILE_CACHE_TTL_MS,
  };
  if (profileCache.size >= 1_000) {
    const oldestUserId = profileCache.keys().next().value;
    if (oldestUserId) profileCache.delete(oldestUserId);
  }
  profileCache.set(userId, profile);
  return profile;
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
  _client: SupabaseClient, // kept for API compat; the server client is used internally
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
    const rawUsername =
      meta.username ||
      meta.name?.replace(/\s+/g, '_').toLowerCase() ||
      user.email?.split('@')[0] ||
      'trader';
    const baseUsername = String(rawUsername).replace(/[^a-zA-Z0-9_]/g, '').slice(0, 48) || 'trader';

    const uniqueUsername = `${baseUsername}_${user.id.replace(/[^a-zA-Z0-9]/g, '').substring(0, 6)}`;
    const displayName = meta.display_name || meta.full_name || meta.name || baseUsername;
    const role = meta.role || 'trader';
    const avatarUrl = meta.avatar_url || meta.picture || null;
    const bio = meta.bio || '';

    const payload = {
      id: user.id,
      email: user.email || `${user.id}@fxzone.local`,
      username: uniqueUsername,
      // Legacy FxZone schemas made this obsolete field NOT NULL. Authentication
      // is handled by Supabase Auth, so the profile fallback stores no password
      // material while remaining compatible until migration 011 is applied.
      password_hash: '',
      display_name: displayName,
      avatar_url: avatarUrl,
      bio,
      role: 'trader',
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
    // getClaims verifies the access-token signature and expiry. For projects
    // using asymmetric signing keys it reuses Supabase's JWKS cache, avoiding
    // an Auth-server round trip on every protected API request.
    const { data: claimsData, error: claimsError } = await client.auth.getClaims(token);
    const claims = claimsData?.claims as Record<string, unknown> | undefined;
    let userId = typeof claims?.sub === 'string' ? claims.sub : null;
    let user: any = userId && claims ? {
      id: userId,
      email: typeof claims.email === 'string' ? claims.email : undefined,
      user_metadata: (claims.user_metadata && typeof claims.user_metadata === 'object') ? claims.user_metadata : {},
      created_at: typeof claims.iat === 'number' ? new Date(claims.iat * 1000).toISOString() : undefined,
    } : null;

    // Older Supabase signing configurations can reject the cached-JWKS path.
    // Verify with the Auth service before rejecting an active signed-in user.
    if (claimsError || !user) {
      const { data: userData, error: userError } = await client.auth.getUser(token);
      if (userError || !userData.user) {
        return { user: null, role: null, error: userError?.message || claimsError?.message || 'Invalid or expired authentication token' };
      }
      user = userData.user;
      userId = user.id;
    }
    if (!userId) return { user: null, role: null, error: 'Invalid or expired authentication token' };

    let profile = await getVerifiedProfile(client, userId);
    if (!profile) {
      // A signed-in user may arrive before the Auth trigger has created their
      // public profile. Provision synchronously so task routes never operate
      // with a partially registered account.
      const provisioned = await ensureUserProfile(client, user);
      if (!provisioned) {
        return { user: null, role: null, error: 'Your account is still being provisioned. Please try again shortly.' };
      }
      profileCache.delete(userId);
      profile = await getVerifiedProfile(client, userId);
    }

    if (!profile) return { user: null, role: null, error: 'Your account could not be verified.' };
    if (!profile.isActive) return { user: null, role: null, error: 'This account has been disabled.' };
    return { user, role: profile.role, error: null };
  } catch (err: any) {
    return { user: null, role: null, error: err.message || 'Authentication error' };
  }
}
