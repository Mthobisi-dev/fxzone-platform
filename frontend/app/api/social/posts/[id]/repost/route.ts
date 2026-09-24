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

    const { data: post, error: postError } = await client
      .from('posts')
      .select('reposts_count')
      .eq('id', postId)
      .maybeSingle();
    if (postError || !post) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 });
    }

    return NextResponse.json({ is_reposted: !existing, reposts_count: post.reposts_count || 0 });
  } catch (error: any) {
    console.error('Post repost error:', error);
    return NextResponse.json(
      { error: error.message || 'Repost action failed' },
      { status: 500 }
    );
  }
}
