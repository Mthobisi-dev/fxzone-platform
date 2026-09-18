import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';



async function getUser(request: NextRequest) {
  const token = request.headers.get('authorization')?.replace('Bearer ', '');
  if (!token) return null;
  try {
    const { data: { user } } = await supabaseAdmin.auth.getUser(token);
    return user;
  } catch { return null; }
}

// GET /api/social/posts — fetch paginated posts (alias for /api/social/feed)
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const limit = parseInt(searchParams.get('limit') || '20', 10);
  const offset = parseInt(searchParams.get('offset') || '0', 10);
  const userId = searchParams.get('user_id');

  try {
    let query = supabaseAdmin
      .from('posts')
      .select(`
        id, content, image_url, likes_count, comments_count, reposts_count,
        is_story, is_pinned, created_at,
        users:user_id (id, username, display_name, avatar_url, role)
      `)
      .eq('is_story', false)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (userId) {
      query = query.eq('user_id', userId);
    }

    const { data, error } = await query;
    if (error) throw error;

    const posts = (data || []).map((p: any) => ({
      id: p.id,
      user_id: p.users?.id,
      user: {
        id: p.users?.id,
        username: p.users?.username,
        full_name: p.users?.display_name,
        display_name: p.users?.display_name,
        avatar_url: p.users?.avatar_url || `https://api.dicebear.com/8.x/initials/svg?seed=${p.users?.username}`,
        role: p.users?.role,
      },
      content: p.content,
      image_url: p.image_url,
      likes_count: p.likes_count || 0,
      comments_count: p.comments_count || 0,
      reposts_count: p.reposts_count || 0,
      is_story: p.is_story,
      created_at: p.created_at,
    }));

    return NextResponse.json(posts);
  } catch (error: any) {
    return NextResponse.json({ error: 'Failed to fetch posts', detail: error?.message }, { status: 500 });
  }
}

// POST /api/social/posts — create a new post
export async function POST(request: NextRequest) {
  try {
    const user = await getUser(request);
    if (!user) return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });

    const body = await request.json();
    const { content, image_url, is_story, asset_tags } = body;

    if (!content?.trim()) {
      return NextResponse.json({ detail: 'Content is required' }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from('posts')
      .insert({
        user_id: user.id,
        content: content.trim(),
        image_url: image_url || null,
        is_story: !!is_story,
        expires_at: is_story ? new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() : null,
      })
      .select()
      .single();

    if (error) throw error;

    // Fetch author profile
    const { data: author } = await supabaseAdmin
      .from('users')
      .select('id, username, display_name, avatar_url, role')
      .eq('id', user.id)
      .single();

    return NextResponse.json({
      ...data,
      user: {
        id: author?.id || user.id,
        username: author?.username || user.email?.split('@')[0],
        display_name: author?.display_name || '',
        avatar_url: author?.avatar_url || null,
        role: author?.role || 'trader',
      },
    }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: 'Failed to create post', detail: error?.message }, { status: 500 });
  }
}
