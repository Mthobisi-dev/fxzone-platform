import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

// GET /api/social/users/[id] — Fetch user profile by ID or username
export async function GET(
  request: NextRequest,
  context: { params: { id: string } | Promise<{ id: string }> }
) {
  try {
    const params = await Promise.resolve(context.params);
    const userId = params.id;

    if (!userId) {
      return NextResponse.json({ detail: 'User ID parameter missing' }, { status: 400 });
    }

    const isUuid = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(userId);

    const db = getSupabaseAdmin(request);
    let data: any = null;
    const profileFields = 'id, username, display_name, avatar_url, bio, role, preferred_broker, followers_count, following_count, created_at';
    const legacyProfileFields = 'id, username, display_name, avatar_url, bio, role, followers_count, following_count, created_at';
    const fetchProfile = (fields: string) => isUuid
      ? db.from('users').select(fields).eq('id', userId).maybeSingle()
      : db.from('users').select(fields).eq('username', userId).maybeSingle();

    let profileResult = await fetchProfile(profileFields);
    if (profileResult.error && (profileResult.error.code === '42703' || profileResult.error.code === 'PGRST204' || /preferred_broker|schema cache|column .* does not exist/i.test(profileResult.error.message || ''))) {
      profileResult = await fetchProfile(legacyProfileFields);
    }
    if (profileResult.error) throw profileResult.error;
    data = profileResult.data;


    if (!data) return NextResponse.json({ detail: 'Trader not found' }, { status: 404 });

    return NextResponse.json({
      ...data,
      displayName: data.display_name || data.username,
      avatarUrl: data.avatar_url,
      preferredBroker: data.preferred_broker || 'Exness',
      preferred_broker: data.preferred_broker || 'Exness',
      followersCount: data.followers_count || 0,
      followingCount: data.following_count || 0,
    });
  } catch (error: any) {
    console.error('Error fetching user:', error);
    return NextResponse.json(
      { error: 'Failed to fetch user profile', detail: error?.message },
      { status: 500 }
    );
  }
}
