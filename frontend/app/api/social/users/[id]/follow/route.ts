import { NextRequest, NextResponse } from 'next/server';
import { ensureUserProfile, getSupabaseAdmin, getUserFromRequest } from '@/lib/supabase';
import { createNotification } from '@/lib/server/notifications';
import { getFollowCounts } from '@/lib/server/socialCounters';

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { user, error: authError } = await getUserFromRequest(request);
    if (authError || !user) return NextResponse.json({ detail: authError || 'Not authenticated' }, { status: 401 });
    const { id: targetIdentifier } = await context.params;
    const db = getSupabaseAdmin(request);
    if (!await ensureUserProfile(db, user)) return NextResponse.json({ detail: 'Your profile is still being provisioned. Please try again in a moment.' }, { status: 503 });
    const isUuid = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(targetIdentifier);
    const { data: target, error: targetError } = isUuid
      ? await db.from('users').select('id, username').eq('id', targetIdentifier).maybeSingle()
      : await db.from('users').select('id, username').eq('username', targetIdentifier).maybeSingle();
    if (targetError) throw targetError;
    if (!target) return NextResponse.json({ detail: 'Trader not found' }, { status: 404 });
    if (target.id === user.id) return NextResponse.json({ detail: 'Cannot follow yourself' }, { status: 400 });
    if (target.username.toLowerCase() === 'jackbot_analysis') return NextResponse.json({ detail: 'jackbot_analysis is a system account and cannot be followed.' }, { status: 403 });
    const { data: existing, error: existingError } = await db.from('follows').select('id').eq('follower_id', user.id).eq('following_id', target.id).maybeSingle();
    if (existingError) throw existingError;
    const is_following = !existing;
    if (existing) {
      const { error } = await db.from('follows').delete().eq('id', existing.id);
      if (error) throw error;
    } else {
      const { error } = await db.from('follows').insert({ follower_id: user.id, following_id: target.id });
      if (error) throw error;
      const actorName = user.user_metadata?.display_name || user.user_metadata?.full_name || user.email?.split('@')[0] || 'A trader';
      void createNotification(db, { recipientId: target.id, actorId: user.id, type: 'follow', title: 'New follower', message: actorName + ' started following you.', data: { profile_id: user.id } });
    }
    const [targetCounts, actorCounts] = await Promise.all([getFollowCounts(db, target.id), getFollowCounts(db, user.id)]);
    return NextResponse.json({ is_following, followers_count: targetCounts.followers_count, following_count: actorCounts.following_count });
  } catch (error: any) {
    console.error('Follow error:', error);
    return NextResponse.json({ error: 'Follow action failed', detail: error?.message }, { status: 500 });
  }
}
