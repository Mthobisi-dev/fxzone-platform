import { NextRequest, NextResponse } from 'next/server';
import { ensureUserProfile, getSupabaseAdmin, getUserFromRequest } from '@/lib/server/supabaseServer';
import { createNotification } from '@/lib/server/notifications';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user, error: authError } = await getUserFromRequest(request);
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: postId } = await params;
    const client = getSupabaseAdmin(request);

    if (!await ensureUserProfile(client, user)) {
      return NextResponse.json({ detail: 'Your profile is still being provisioned. Please try again in a moment.' }, { status: 503 });
    }

    let { data: post, error: postError } = await client
      .from('posts')
      .select('id, user_id, allow_reshare')
      .eq('id', postId)
      .maybeSingle();
    // allow_reshare is an optional composer column in older Supabase schemas.
    if (postError && (postError.code === '42703' || postError.code === 'PGRST204')) {
      ({ data: post, error: postError } = await client
        .from('posts')
        .select('id, user_id')
        .eq('id', postId)
        .maybeSingle());
    }
    if (postError) throw postError;
    if (!post) return NextResponse.json({ error: 'Post not found' }, { status: 404 });
    if (post.allow_reshare === false) {
      return NextResponse.json({ detail: 'The author has disabled reshares for this post.' }, { status: 403 });
    }

    const { data: existing, error: existingError } = await client
      .from('reposts')
      .select('id')
      .eq('post_id', postId)
      .eq('user_id', user.id)
      .maybeSingle();
    if (existingError) throw existingError;

    if (existing) {
      const { error } = await client.from('reposts').delete().eq('id', existing.id);
      if (error) throw error;
    } else {
      const { error } = await client.from('reposts').insert({ post_id: postId, user_id: user.id });
      if (error) throw error;
    }

    const { data: updatedPost, error: updatedPostError } = await client
      .from('posts')
      .select('reposts_count')
      .eq('id', postId)
      .maybeSingle();
    if (updatedPostError || !updatedPost) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 });
    }

    if (!existing) {
      const actorName = user.user_metadata?.display_name || user.user_metadata?.full_name || user.email?.split('@')[0] || 'A trader';
      await createNotification(client, {
        recipientId: post.user_id,
        actorId: user.id,
        type: 'repost',
        title: 'New repost',
        message: `${actorName} reshared your post.`,
        data: { post_id: postId },
      });
    }

    return NextResponse.json({ is_reposted: !existing, reposts_count: updatedPost.reposts_count || 0 });
  } catch (error: any) {
    console.error('Post repost error:', error);
    return NextResponse.json(
      { error: error.message || 'Repost action failed' },
      { status: 500 }
    );
  }
}
