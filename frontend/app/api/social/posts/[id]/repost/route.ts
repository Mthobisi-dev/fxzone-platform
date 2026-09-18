import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin, getUserFromRequest } from '@/lib/server/supabaseServer';

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

    // Get current post
    const { data: post, error: fetchErr } = await client
      .from('posts')
      .select('reposts_count')
      .eq('id', postId)
      .single();

    if (fetchErr || !post) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 });
    }

    const newCount = (post.reposts_count || 0) + 1;

    await client
      .from('posts')
      .update({ reposts_count: newCount })
      .eq('id', postId);

    return NextResponse.json({ reposts_count: newCount });
  } catch (error: any) {
    console.error('Post repost error:', error);
    return NextResponse.json(
      { error: error.message || 'Repost action failed' },
      { status: 500 }
    );
  }
}
