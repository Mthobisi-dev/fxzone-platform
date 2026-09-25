import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin, getUserFromRequest } from '@/lib/supabase';
import { createNotification } from '@/lib/server/notifications';

// POST /api/social/users/[id]/follow — toggle follow/unfollow
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { user, error: authError } = await getUserFromRequest(request);
    if (authError || !user) return NextResponse.json({ detail: authError || 'Not authenticated' }, { status: 401 });

    const { id: targetUserId } = await context.params;

    if (targetUserId === user.id) {
      return NextResponse.json({ detail: 'Cannot follow yourself' }, { status: 400 });
    }

    const db = getSupabaseAdmin(request);
    const { data: target } = await db.from('users').select('id, username, display_name').eq('id', targetUserId).maybeSingle();
    if (!target) return NextResponse.json({ detail: 'Trader not found' }, { status: 404 });

    const { data: existing, error: existingError } = await db
      .from('follows')
      .select('id')
      .eq('follower_id', user.id)
      .eq('following_id', targetUserId)
      .single();
    if (existingError && existingError.code !== 'PGRST116') throw existingError;

    let is_following: boolean;

    if (existing) {
      const { error } = await db.from('follows').delete().eq('id', existing.id);
      if (error) throw error;
      is_following = false;
    } else {
      const { error } = await db.from('follows').insert({
        follower_id: user.id,
        following_id: targetUserId,
      });
      if (error) throw error;
      is_following = true;
      const actorName = user.user_metadata?.display_name || user.user_metadata?.full_name || user.email?.split('@')[0] || 'A trader';
      await createNotification(db, {
        recipientId: targetUserId,
        actorId: user.id,
        type: 'follow',
        title: 'New follower',
        message: `${actorName} started following you.`,
        data: { profile_id: user.id },
      });
    }

    // Get updated counts
    const { data: updatedTarget } = await db
      .from('users')
      .select('followers_count')
      .eq('id', targetUserId)
      .single();
    return NextResponse.json({ is_following, followers_count: updatedTarget?.followers_count || 0 });
  } catch (error: any) {
    console.error('Follow error:', error);
    return NextResponse.json({ error: 'Follow action failed', detail: error?.message }, { status: 500 });
  }
}
