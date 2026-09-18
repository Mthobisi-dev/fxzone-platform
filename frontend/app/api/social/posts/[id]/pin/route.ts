import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

async function getUser(request: NextRequest) {
  const token = request.headers.get('authorization')?.replace('Bearer ', '');
  if (!token) return null;
  try {
    const { data: { user } } = await supabaseAdmin.auth.getUser(token);
    return user;
  } catch {
    return null;
  }
}

// POST /api/social/posts/[id]/pin — Toggle pin status on post
export async function POST(
  request: NextRequest,
  context: { params: { id: string } | Promise<{ id: string }> }
) {
  try {
    const params = await Promise.resolve(context.params);
    const postId = params.id;

    const user = await getUser(request);
    if (!user) {
      return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });
    }

    const { data: post, error: fetchError } = await supabaseAdmin
      .from('posts')
      .select('id, is_pinned, user_id')
      .eq('id', postId)
      .maybeSingle();

    if (fetchError || !post) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 });
    }

    const newPinned = !post.is_pinned;

    const { error: updateError } = await supabaseAdmin
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
