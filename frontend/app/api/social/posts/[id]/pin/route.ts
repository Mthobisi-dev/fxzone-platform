import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin, getUserFromRequest } from '@/lib/supabase';

// POST /api/social/posts/[id]/pin — Toggle pin status on post
export async function POST(
  request: NextRequest,
  context: { params: { id: string } | Promise<{ id: string }> }
) {
  try {
    const params = await Promise.resolve(context.params);
    const postId = params.id;

    const { user, error: authError } = await getUserFromRequest(request);
    if (authError || !user) {
      return NextResponse.json({ detail: authError || 'Not authenticated' }, { status: 401 });
    }

    const db = getSupabaseAdmin(request);

    const { data: post, error: fetchError } = await db
      .from('posts')
      .select('id, is_pinned, user_id')
      .eq('id', postId)
      .maybeSingle();

    if (fetchError || !post) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 });
    }
    if (post.user_id !== user.id) {
      return NextResponse.json({ detail: 'You can only pin your own posts.' }, { status: 403 });
    }

    const newPinned = !post.is_pinned;

    const { error: updateError } = await db
      .from('posts')
      .update({ is_pinned: newPinned })
      .eq('id', postId);

    if (updateError) throw updateError;

    return NextResponse.json({
      id: postId,
      is_pinned: newPinned,
      message: newPinned ? 'Post pinned' : 'Post unpinned',
    });
  } catch (error: any) {
    console.error('Pin post error:', error);
    return NextResponse.json(
      { error: 'Failed to pin post', detail: error?.message },
      { status: 500 }
    );
  }
}
