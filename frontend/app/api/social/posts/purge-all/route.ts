import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin, getUserFromRequest } from '@/lib/supabase';

// DELETE /api/social/posts/purge-all — Purge feed posts for user
export async function DELETE(request: NextRequest) {
  try {
    const { user, error: authErr } = await getUserFromRequest(request);
    if (authErr || !user) {
      return NextResponse.json({ detail: authErr || 'Not authenticated' }, { status: 401 });
    }

    const db = getSupabaseAdmin(request);

    // Fetch user's post IDs
    const { data: userPosts } = await db
      .from('posts')
      .select('id')
      .eq('user_id', user.id);

    if (userPosts && userPosts.length > 0) {
      const postIds = userPosts.map((p) => p.id);

      // Clean up dependent child tables first. Supabase reports database
      // failures in each result object rather than rejecting the promise.
      const dependencyResults = await Promise.all([
        db.from('comments').delete().in('post_id', postIds),
        db.from('reactions').delete().in('post_id', postIds),
        db.from('bookmarks').delete().in('post_id', postIds),
        db.from('post_asset_tags').delete().in('post_id', postIds),
      ]);
      const dependencyError = dependencyResults.find((result) => result.error)?.error;
      if (dependencyError) {
        console.error('Bulk post dependency cleanup error:', dependencyError.message);
        return NextResponse.json({ error: 'Unable to remove related post data' }, { status: 500 });
      }

      // Delete posts
      const { error: deleteErr } = await db
        .from('posts')
        .delete()
        .eq('user_id', user.id);

      if (deleteErr) throw deleteErr;
    }

    return NextResponse.json({ message: 'Feed posts purged successfully' });
  } catch (error: any) {
    console.error('Purge posts error:', error);
    return NextResponse.json(
      { error: 'Failed to purge posts', detail: error?.message },
      { status: 500 }
    );
  }
}
