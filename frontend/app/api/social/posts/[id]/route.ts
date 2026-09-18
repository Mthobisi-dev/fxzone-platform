import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin, getUserFromRequest } from '@/lib/supabase';

// GET /api/social/posts/[id] — Fetch single post details
export async function GET(
  request: NextRequest,
  context: { params: { id: string } | Promise<{ id: string }> }
) {
  try {
    const params = await Promise.resolve(context.params);
    const postId = params.id;
    const db = getSupabaseAdmin(request);

    const { data: post, error } = await db
      .from('posts')
      .select(`
        id, content, image_url, likes_count, comments_count, reposts_count,
        is_story, is_pinned, created_at, user_id,
        users:user_id (id, username, display_name, avatar_url, role)
      `)
      .eq('id', postId)
      .maybeSingle();

    if (error || !post) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 });
    }

    return NextResponse.json(post);
  } catch (error: any) {
    return NextResponse.json({ error: 'Failed to fetch post', detail: error?.message }, { status: 500 });
  }
}

// DELETE /api/social/posts/[id] — Robust post deletion (Owner or Admin)
export async function DELETE(
  request: NextRequest,
  context: { params: { id: string } | Promise<{ id: string }> }
) {
  try {
    const params = await Promise.resolve(context.params);
    const postId = params.id;

    if (!postId) {
      return NextResponse.json({ error: 'Post ID is required' }, { status: 400 });
    }

    const { user, role, error: authErr } = await getUserFromRequest(request);
    if (authErr || !user) {
      return NextResponse.json({ detail: authErr || 'Not authenticated' }, { status: 401 });
    }

    const db = getSupabaseAdmin(request);

    // Check if postId is a valid UUID format
    const isUuid = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(postId);
    if (!isUuid) {
      return NextResponse.json({ message: 'Post removed from UI', id: postId });
    }

    // 1. Fetch target post from Supabase
    const { data: post, error: fetchError } = await db
      .from('posts')
      .select('id, user_id')
      .eq('id', postId)
      .maybeSingle();

    if (fetchError) {
      console.warn('Post query notice:', fetchError.message);
    }

    // If post is not present in DB, return success to clear UI state
    if (!post) {
      return NextResponse.json({ message: 'Post already deleted', id: postId });
    }

    // 2. Authorize deletion (Post author or Platform admin)
    const isOwner = post.user_id === user.id;
    const isAdmin =
      role === 'admin' ||
      user.email === 'mthobisimzimela031@gmail.com' ||
      user.email === 'admin@fxzone.com' ||
      user.user_metadata?.role === 'admin';

    if (!isOwner && !isAdmin) {
      return NextResponse.json(
        { error: 'Forbidden: Only post author or admin can delete this post' },
        { status: 403 }
      );
    }

    // 3. Delete dependent rows in parallel/sequence to prevent foreign key errors
    await Promise.allSettled([
      db.from('comments').delete().eq('post_id', postId),
      db.from('reactions').delete().eq('post_id', postId),
      db.from('post_reactions').delete().eq('post_id', postId),
      db.from('bookmarks').delete().eq('post_id', postId),
      db.from('post_asset_tags').delete().eq('post_id', postId),
    ]);

    // 4. Delete post row from posts table
    const { error: deleteError } = await db
      .from('posts')
      .delete()
      .eq('id', postId);

    if (deleteError) {
      console.error('Database post delete error:', deleteError.message);
      // Fallback: If hard delete is blocked by RLS/constraints, soft delete post content
      try {
        await db.from('posts').update({ content: '[deleted]', image_url: null }).eq('id', postId);
      } catch (_) {}
    }

    return NextResponse.json({
      message: 'Post deleted successfully',
      id: postId,
    });
  } catch (error: any) {
    console.error('Delete post exception:', error);
    return NextResponse.json(
      { error: 'Failed to delete post', detail: error?.message },
      { status: 500 }
    );
  }
}
