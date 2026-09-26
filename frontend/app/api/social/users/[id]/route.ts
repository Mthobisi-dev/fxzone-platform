import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin, getUserFromRequest } from '@/lib/supabase';
import { getFollowCounts } from '@/lib/server/socialCounters';

// Fetch a profile by UUID or username with legacy-schema compatibility.
export async function GET(request: NextRequest, context: { params: { id: string } | Promise<{ id: string }> }) {
  try {
    const params = await Promise.resolve(context.params);
    const userId = params.id;
    if (!userId) return NextResponse.json({ detail: 'User ID parameter missing' }, { status: 400 });

    const isUuid = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(userId);
    const db = getSupabaseAdmin(request);
    const { user: viewer } = await getUserFromRequest(request);
    const currentFields = 'id, username, display_name, avatar_url, bio, role, preferred_broker, followers_count, following_count, created_at';
    const legacyFields = 'id, username, display_name, avatar_url, bio, role, followers_count, following_count, created_at';
    const fetchProfile = (fields: string) => isUuid
      ? db.from('users').select(fields).eq('id', userId).maybeSingle()
      : db.from('users').select(fields).eq('username', userId).maybeSingle();

    let result = await fetchProfile(currentFields);
    if (result.error && (result.error.code === '42703' || result.error.code === 'PGRST204' || /preferred_broker|schema cache|column .* does not exist/i.test(result.error.message || ''))) {
      result = await fetchProfile(legacyFields);
    }
    if (result.error) throw result.error;
    const data: any = result.data;
    if (!data) return NextResponse.json({ detail: 'Trader not found' }, { status: 404 });

    const counts = await getFollowCounts(db, data.id);
    const { data: follow } = viewer && viewer.id !== data.id
      ? await db.from('follows').select('id').eq('follower_id', viewer.id).eq('following_id', data.id).maybeSingle()
      : { data: null };
    const preferredBroker = data.preferred_broker || (viewer?.id === data.id ? viewer.user_metadata?.preferred_broker : null) || 'Exness';

    return NextResponse.json({
      ...data,
      displayName: data.display_name || data.username,
      avatarUrl: data.avatar_url,
      preferredBroker,
      preferred_broker: preferredBroker,
      followersCount: counts.followers_count,
      followingCount: counts.following_count,
      isFollowing: Boolean(follow),
    });
  } catch (error: any) {
    console.error('Error fetching user:', error);
    return NextResponse.json({ error: 'Failed to fetch user profile', detail: error?.message }, { status: 500 });
  }
}
