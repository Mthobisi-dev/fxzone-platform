import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin, getUserFromRequest } from '@/lib/supabase';

// GET /api/social/posts/saved — Fetch saved posts for authenticated user
export async function GET(request: NextRequest) {
  try {
    const { user, error: authError } = await getUserFromRequest(request);
    if (authError || !user) return NextResponse.json({ detail: authError || 'Not authenticated' }, { status: 401 });
    const { data: saved, error } = await getSupabaseAdmin(request)
      .from('bookmarks')
      .select(`
        created_at,
        posts:post_id (
          id, content, image_url, likes_count, comments_count, reposts_count,
          is_story, is_pinned, created_at,
          users:user_id (id, username, display_name, avatar_url, role)
        )
      `)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    if (error) throw error;

    const posts = (saved || []).map((item: any) => item.posts).filter(Boolean).map((p: any) => ({
      id: p.id,
      user_id: p.users?.id,
      user: { id: p.users?.id, username: p.users?.username, display_name: p.users?.display_name, avatar_url: p.users?.avatar_url, role: p.users?.role },
      content: p.content,
      image_url: p.image_url,
      likes_count: p.likes_count || 0,
      comments_count: p.comments_count || 0,
      reposts_count: p.reposts_count || 0,
      is_bookmarked_by_user: true,
      created_at: p.created_at,
    }));
    return NextResponse.json(posts);
  } catch (error: any) {
    console.error('Saved posts error:', error);
    return NextResponse.json({ detail: error?.message || 'Unable to load saved posts' }, { status: 500 });
  }
}
