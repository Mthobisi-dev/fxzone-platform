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

// GET /api/social/posts/[id] — Fetch single post details
export async function GET(
  request: NextRequest,
  context: { params: { id: string } | Promise<{ id: string }> }
) {
  try {
    const params = await Promise.resolve(context.params);
    const postId = params.id;

    const { data: post, error } = await supabaseAdmin
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

    const user = await getUser(request);
    if (!user) {
      return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });
    }

    // Check if postId is a valid UUID format
    const isUuid = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(postId);
    if (!isUuid) {
      // Non-UUID post (e.g. temporary/mock client ID) — confirm success for UI cleanup
      return NextResponse.json({ message: 'Post removed from UI', id: postId });
    }

    // 1. Fetch target post from Supabase
    const { data: post, error: fetchError } = await supabaseAdmin
      .from('posts')
      .select('id, user_id')
      .eq('id', postId)
      .maybeSingle();

    if (fetchError) {
      console.warn('Post query warning:', fetchError.message);
    }

    // If post not present in DB, treat as already deleted
    if (!post) {
      return NextResponse.json({ message: 'Post already deleted', id: postId });
    }

    // 2. Fetch user profile to verify admin role
    const { data: profile } = await supabaseAdmin
      .from('users')
      .select('username, display_name, role')
      .eq('id', user.id)
      .maybeSingle();

    const isOwner = post.user_id === user.id;
    const isAdmin =
      user.email === 'mthobisimzimela031@gmail.com' ||
      user.email === 'admin@fxzone.com' ||
      profile?.username === 'admin' ||
      profile?.role === 'admin' ||
      (user.user_metadata as any)?.role === 'admin';

    if (!isOwner && !isAdmin) {
      return NextResponse.json(
        { error: 'Forbidden: Only post author or admin can delete this post' },
        { status: 403 }
      );
    }

    // 3. Delete dependent rows (comments, reactions) safely
    try {
      await supabaseAdmin.from('comments').delete().eq('post_id', postId);
    } catch {}
    try {
      await supabaseAdmin.from('post_reactions').delete().eq('post_id', postId);
    } catch {}

    // 4. Delete post from posts table
    const { error: deleteError } = await supabaseAdmin
      .from('posts')
      .delete()
      .eq('id', postId);

    if (deleteError) {
      console.error('Database delete error:', deleteError.message);
      throw deleteError;
    }

    return NextResponse.json({
      message: 'Post deleted successfully',
      id: postId,
    });
  } catch (error: any) {
    console.error('Delete post error:', error);
    return NextResponse.json(
      { error: 'Failed to delete post', detail: error?.message },
      { status: 500 }
    );
  }
}
