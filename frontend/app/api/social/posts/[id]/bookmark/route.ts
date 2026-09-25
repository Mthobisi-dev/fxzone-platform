import { NextRequest, NextResponse } from 'next/server';
import { ensureUserProfile, getSupabaseAdmin, getUserFromRequest } from '@/lib/server/supabaseServer';

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

    const { data: post, error: postError } = await client
      .from('posts')
      .select('id, allow_save')
      .eq('id', postId)
      .maybeSingle();
    if (postError) throw postError;
    if (!post) return NextResponse.json({ error: 'Post not found' }, { status: 404 });
    if (post.allow_save === false) {
      return NextResponse.json({ detail: 'The author has disabled saving for this post.' }, { status: 403 });
    }

    // The canonical Supabase table is `bookmarks` (not the legacy
    // `saved_posts` name). It has a unique user_id/post_id constraint.
    const { data: existing, error: existingError } = await client
      .from('bookmarks')
      .select('id')
      .eq('user_id', user.id)
      .eq('post_id', postId)
      .maybeSingle();
    if (existingError) throw existingError;

    let isBookmarked = false;

    if (existing) {
      const { error } = await client
        .from('bookmarks')
        .delete()
        .eq('user_id', user.id)
        .eq('post_id', postId);
      if (error) throw error;
      isBookmarked = false;
    } else {
      const { error } = await client
        .from('bookmarks')
        .upsert(
          { user_id: user.id, post_id: postId, created_at: new Date().toISOString() },
          { onConflict: 'user_id,post_id' }
        );
      if (error) throw error;
      isBookmarked = true;
    }

    return NextResponse.json({ is_bookmarked: isBookmarked });
  } catch (error: any) {
    console.error('Post bookmark error:', error);
    return NextResponse.json(
      { error: error.message || 'Bookmark action failed' },
      { status: 500 }
    );
  }
}
