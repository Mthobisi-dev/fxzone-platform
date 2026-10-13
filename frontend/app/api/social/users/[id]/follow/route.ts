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
      ? await db.from('users').select('id, username, role').eq('id', targetIdentifier).maybeSingle()
      : await db.from('users').select('id, username, role').eq('username', targetIdentifier).maybeSingle();
    if (targetError) throw targetError;
    if (!target) return NextResponse.json({ detail: 'Trader not found' }, { status: 404 });
    if (target.id === user.id) return NextResponse.json({ detail: 'Cannot follow yourself' }, { status: 400 });
    if (['jackbot_analysis', 'fxzone_bot', 'fxzone_admin'].includes(target.username.toLowerCase()) || target.role === 'admin') {
      return NextResponse.json({ detail: 'This is a protected system account and cannot be followed.' }, { status: 403 });
    }
    const { data: existing, error: existingError } = await db.from('follows').select('id').eq('follower_id', user.id).eq('following_id', target.id).maybeSingle();
    if (existingError) throw existingError;
    // Existing profile controls use this endpoint as a toggle. A caller may
    // explicitly state the desired state when following is a prerequisite for
    // an access request, avoiding a retry that accidentally unfollows a host.
    let requestedFollowing: boolean | undefined;
    try {
      const body: unknown = await request.json();
      if (body && typeof body === 'object' && typeof (body as { following?: unknown }).following === 'boolean') {
        requestedFollowing = (body as { following: boolean }).following;
      }
    } catch {
      // Empty request bodies retain the backwards-compatible toggle behavior.
    }
    const is_following = requestedFollowing ?? !existing;
    if (existing && !is_following) {
      const { error } = await db.from('follows').delete().eq('id', existing.id);
      if (error) throw error;
    } else if (!existing && is_following) {
      const { error } = await db.from('follows').insert({ follower_id: user.id, following_id: target.id });
      if (error) throw error;
      const actorName = user.user_metadata?.display_name || user.user_metadata?.full_name || user.email?.split('@')[0] || 'A trader';
      void createNotification(db, { recipientId: target.id, actorId: user.id, type: 'follow', title: 'New follower', message: actorName + ' started following you.', data: { profile_id: user.id } });
    }
    const [targetCounts, actorCounts] = await Promise.all([getFollowCounts(db, target.id), getFollowCounts(db, user.id)]);
    return NextResponse.json({
      is_following,
      // Backwards-compatible counts for the profile being followed/unfollowed.
      followers_count: targetCounts.followers_count,
      following_count: targetCounts.following_count,
      target_followers_count: targetCounts.followers_count,
      target_following_count: targetCounts.following_count,
      actor_followers_count: actorCounts.followers_count,
      actor_following_count: actorCounts.following_count,
    });
  } catch (error: any) {
    console.error('Follow error:', error);
    return NextResponse.json({ error: 'Follow action failed', detail: error?.message }, { status: 500 });
  }
}
