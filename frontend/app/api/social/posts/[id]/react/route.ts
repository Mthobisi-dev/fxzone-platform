import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin, getUserFromRequest, ensureUserProfile } from '@/lib/server/supabaseServer';
import { createNotification } from '@/lib/server/notifications';
import { getPostInteractionCounts } from '@/lib/server/socialCounters';
import { storyAudienceIds } from '@/lib/storyAudience';

// POST /api/social/posts/[id]/react — toggle like/reaction
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { user, error: authErr } = await getUserFromRequest(request);
    if (authErr || !user) {
      return NextResponse.json({ detail: authErr || 'Not authenticated' }, { status: 401 });
    }

    const { id } = await context.params;
    const body = await request.json();
    const reactionType = body.reaction_type || 'like';
    if (reactionType !== 'like') {
      return NextResponse.json({ detail: 'Only likes are supported for this post.' }, { status: 400 });
    }

    const db = getSupabaseAdmin(request);

    // Ensure profile row exists before writing (reactions has FK to users)
    if (!await ensureUserProfile(db, user)) {
      return NextResponse.json({ detail: 'Your profile is still being provisioned. Please try again in a moment.' }, { status: 503 });
    }

    const { data: post, error: postError } = await db
      .from('posts')
      .select('user_id, is_story')
      .eq('id', id)
      .maybeSingle();
    if (postError) throw postError;
    if (!post) return NextResponse.json({ detail: 'Post not found' }, { status: 404 });

    if (post.is_story && post.user_id !== user.id) {
      const [outgoing, incoming] = await Promise.all([
        db.from('follows').select('following_id').eq('follower_id', user.id),
        db.from('follows').select('follower_id').eq('following_id', user.id),
      ]);
      if (outgoing.error) throw outgoing.error;
      if (incoming.error) throw incoming.error;
      if (!storyAudienceIds(user.id, outgoing.data || [], incoming.data || []).includes(post.user_id)) {
        return NextResponse.json({ detail: 'This story is only available to mutual followers.' }, { status: 403 });
      }
    }

    // Check if reaction exists
    const { data: existing, error: existingError } = await db
      .from('reactions')
      .select('id')
      .eq('post_id', id)
      .eq('user_id', user.id)
      .eq('reaction_type', reactionType)
      .maybeSingle();
    if (existingError) throw existingError;

    let active: boolean;

    if (existing) {
      const { error } = await db.from('reactions').delete().eq('id', existing.id);
      if (error) throw error;
      active = false;
    } else {
      const { error } = await db.from('reactions').insert({
        post_id: id,
        user_id: user.id,
        reaction_type: reactionType,
      });
      if (error) throw error;
      active = true;
    }

    // The database trigger updates the counter atomically. Read the resulting
    // value instead of racing a client-side count/update sequence.
    const { likes_count } = await getPostInteractionCounts(db, id);
    if (active) {
      const actorName = user.user_metadata?.display_name || user.user_metadata?.full_name || user.email?.split('@')[0] || 'A trader';
      await createNotification(db, {
        recipientId: post.user_id,
        actorId: user.id,
        type: 'like',
        title: post.is_story ? 'New story like' : 'New like',
        message: `${actorName} liked your ${post.is_story ? 'story' : 'post'}.`,
        data: { post_id: id },
      });
    }

    return NextResponse.json({ active, likes_count, reaction_type: reactionType });
  } catch (error: any) {
    console.error('React error:', error);
    return NextResponse.json({ error: 'Failed to react', detail: error?.message }, { status: 500 });
  }
}
