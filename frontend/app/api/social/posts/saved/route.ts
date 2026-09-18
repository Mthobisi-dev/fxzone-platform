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

// GET /api/social/posts/saved — Fetch saved posts for authenticated user
export async function GET(request: NextRequest) {
  try {
    const user = await getUser(request);
    if (!user) {
      return NextResponse.json([]);
    }

    // Attempt to query saved_posts join table from Supabase
    try {
      const { data: saved, error } = await supabaseAdmin
        .from('saved_posts')
        .select(`
          posts:post_id (
            id, content, image_url, likes_count, comments_count, reposts_count,
            is_story, is_pinned, created_at,
            users:user_id (id, username, display_name, avatar_url, role)
          )
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (!error && Array.isArray(saved)) {
        const posts = saved
          .map((item: any) => item.posts)
          .filter(Boolean)
          .map((p: any) => ({
            id: p.id,
            user_id: p.users?.id,
            user: {
              id: p.users?.id,
              username: p.users?.username,
              display_name: p.users?.display_name,
              avatar_url: p.users?.avatar_url,
              role: p.users?.role,
            },
            content: p.content,
            image_url: p.image_url,
            likes_count: p.likes_count || 0,
            comments_count: p.comments_count || 0,
            reposts_count: p.reposts_count || 0,
            is_bookmarked_by_user: true,
            created_at: p.created_at,
          }));

        return NextResponse.json(posts);
      }
    } catch {
      // Table saved_posts may be created dynamically or handled via local storage
    }

    // Fallback: Return empty array
    return NextResponse.json([]);
  } catch (error: any) {
    console.error('Saved posts error:', error);
    return NextResponse.json([]);
  }
}
