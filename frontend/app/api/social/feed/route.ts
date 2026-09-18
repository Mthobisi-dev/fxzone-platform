import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';



// GET /api/social/feed — paginated social posts with author info
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '20', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    const { data, error } = await supabaseAdmin
      .from('posts')
      .select(`
        id,
        content,
        image_url,
        likes_count,
        comments_count,
        reposts_count,
        is_story,
        is_pinned,
        created_at,
        users:user_id (
          id,
          username,
          display_name,
          avatar_url,
          role
        )
      `)
      .eq('is_story', false)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;

    // Normalize the response shape expected by frontend
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
      media_type: p.image_url ? 'image' : 'none',
      likes_count: p.likes_count || 0,
      comments_count: p.comments_count || 0,
      reposts_count: p.reposts_count || 0,
      is_story: p.is_story,
      is_pinned: p.is_pinned,
      created_at: p.created_at,
    }));

    return NextResponse.json(posts, {
      headers: { 'Cache-Control': 'no-cache, no-store' },
    });
  } catch (error: any) {
    console.error('Social feed error:', error);
    return NextResponse.json(
      { error: 'Failed to load feed', detail: error?.message },
      { status: 500 }
    );
  }
}

// POST /api/social/feed — create a new post
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');

    if (!token) {
      return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });
    }

    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ detail: 'Invalid session' }, { status: 401 });
    }

    const body = await request.json();
    const { content, image_url, is_story } = body;

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
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(data, { status: 201 });
  } catch (error: any) {
    console.error('Create post error:', error);
    return NextResponse.json(
      { error: 'Failed to create post', detail: error?.message },
      { status: 500 }
    );
  }
}
