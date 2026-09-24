import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

// GET /api/social/users/[id]/posts — fetch real posts authored by target user
export async function GET(
  request: NextRequest,
  context: { params: { id: string } | Promise<{ id: string }> }
) {
  try {
    const params = await Promise.resolve(context.params);
    const userId = params.id;

    if (!userId) {
      return NextResponse.json([]);
    }

    const { data: posts, error } = await supabaseAdmin
      .from('posts')
      .select(`
        id, content, image_url, likes_count, comments_count, reposts_count,
        is_story, is_pinned, created_at,
        users:user_id (id, username, display_name, avatar_url, role)
      `)
      .eq('user_id', userId)
      .eq('is_story', false)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) throw error;

    const formatted = (posts || []).map((p: any) => ({
      id: p.id,
      user_id: p.users?.id || userId,
      user: {
        id: p.users?.id || userId,
        username: p.users?.username || 'trader',
        display_name: p.users?.display_name || p.users?.username || 'Trader',
        avatar_url: p.users?.avatar_url || null,
        role: p.users?.role || 'trader',
      },
      content: p.content,
      image_url: p.image_url,
      likes_count: p.likes_count || 0,
      comments_count: p.comments_count || 0,
      reposts_count: p.reposts_count || 0,
      created_at: p.created_at,
    }));

    return NextResponse.json(formatted);
  } catch (error: any) {
    console.error('Error fetching user posts:', error);
    return NextResponse.json([], { status: 200 });
  }
}
