import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';

let adminClientInstance: SupabaseClient | null = null;

export function getSupabaseAdmin(request?: Request): SupabaseClient {
  if (!supabaseUrl) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL or SUPABASE_URL is not defined in environment variables.');
  }

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

  return createClient(supabaseUrl, supabaseAnonKey || 'placeholder-key', {
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

export async function ensureUserProfile(client: SupabaseClient, user: any): Promise<void> {
  if (!user || !user.id) return;

  try {
    // 1. Check if user profile already exists
    const { data: existing } = await client
      .from('users')
      .select('id')
      .eq('id', user.id)
      .maybeSingle();

    if (existing) return;

    // 2. Prepare profile data with fallback unique username
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

    const { error } = await client.from('users').upsert(payload, { onConflict: 'id' });

    if (error) {
      // If RLS policy blocks INSERT, attempt UPDATE in case profile row exists
      await client.from('users').update({
        display_name: displayName,
        avatar_url: avatarUrl,
        updated_at: new Date().toISOString()
      }).eq('id', user.id);
    }
  } catch (_) {
    // Silently ignore optional profile initialization exceptions
  }
}

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
    const { data: { user }, error } = await client.auth.getUser(token);

    if (error || !user) {
      return { user: null, role: null, error: error?.message || 'Invalid authentication token' };
    }

    // Always ensure public.users record exists for foreign key constraints
    await ensureUserProfile(client, user);

    let role = 'trader';
    const { data: profile } = await client
      .from('users')
      .select('role')
      .eq('id', user.id)
      .maybeSingle();

    if (profile?.role) {
      role = profile.role;
    } else {
      role = user.user_metadata?.role || 'trader';
    }

    return { user, role, error: null };
  } catch (err: any) {
    return { user: null, role: null, error: err.message || 'Authentication error' };
  }
}


