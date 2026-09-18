import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';



async function getUser(request: NextRequest) {
  const token = request.headers.get('authorization')?.replace('Bearer ', '');
  if (!token) return null;
  try {
    const { data: { user } } = await supabaseAdmin.auth.getUser(token);
    return user;
  } catch { return null; }
}

// POST /api/social/users/[id]/follow — toggle follow/unfollow
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUser(request);
    if (!user) return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });

    const { id: targetUserId } = await context.params;

    if (targetUserId === user.id) {
      return NextResponse.json({ detail: 'Cannot follow yourself' }, { status: 400 });
    }

    // Check existing follow
    const { data: existing } = await supabaseAdmin
      .from('follows')
      .select('id')
      .eq('follower_id', user.id)
      .eq('following_id', targetUserId)
      .single();

    let is_following: boolean;

    if (existing) {
      await supabaseAdmin.from('follows').delete().eq('id', existing.id);
      is_following = false;
    } else {
      await supabaseAdmin.from('follows').insert({
        follower_id: user.id,
        following_id: targetUserId,
      });
      is_following = true;
    }

    // Get updated counts
    const { count: followerCount } = await supabaseAdmin
      .from('follows')
      .select('id', { count: 'exact', head: true })
      .eq('following_id', targetUserId);

    const { count: followingCount } = await supabaseAdmin
      .from('follows')
      .select('id', { count: 'exact', head: true })
      .eq('follower_id', user.id);

    await supabaseAdmin
      .from('users')
      .update({ followers_count: followerCount || 0 })
      .eq('id', targetUserId);

    await supabaseAdmin
      .from('users')
      .update({ following_count: followingCount || 0 })
      .eq('id', user.id);

    return NextResponse.json({ is_following, followers_count: followerCount || 0 });
  } catch (error: any) {
    console.error('Follow error:', error);
    return NextResponse.json({ error: 'Follow action failed', detail: error?.message }, { status: 500 });
  }
}
