import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin, getUserFromRequest, ensureUserProfile } from '@/lib/server/supabaseServer';

// GET /api/social/posts — fetch paginated posts (alias for /api/social/feed)
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const limit = parseInt(searchParams.get('limit') || '20', 10);
  const offset = parseInt(searchParams.get('offset') || '0', 10);
  const userId = searchParams.get('user_id');

  try {
    const db = getSupabaseAdmin(request);

    let query = db
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
        avatar_url: p.users?.avatar_url || `https://api.dicebear.com/8.x/initials/svg?seed=${p.users?.username || 'user'}`,
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
    const { user, error: authErr } = await getUserFromRequest(request);
    if (authErr || !user) {
      return NextResponse.json({ detail: authErr || 'Not authenticated' }, { status: 401 });
    }

    const body = await request.json();
    const { content, image_url, is_story } = body;

    let finalContent = (content || '').trim();
    if (!finalContent) {
      if (image_url || is_story) {
        finalContent = '📊 Shared media attachment';
      } else {
        return NextResponse.json({ detail: 'Content is required' }, { status: 400 });
      }
    }

    const db = getSupabaseAdmin(request);
    await ensureUserProfile(db, user);

    let insertRes = await db
      .from('posts')
      .insert({
        user_id: user.id,
        content: finalContent,
        image_url: image_url || null,
        is_story: !!is_story,
        expires_at: is_story ? new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() : null,
      })
      .select()
      .single();

    // If FK constraint violation occurred, force user upsert and retry once
    if (insertRes.error && (insertRes.error.code === '23503' || insertRes.error.message?.includes('posts_user_id_fkey'))) {
      console.warn('[Posts API] FK constraint error detected on user_id, retrying with force profile upsert...');
      await ensureUserProfile(db, user);
      insertRes = await db
        .from('posts')
        .insert({
          user_id: user.id,
          content: finalContent,
          image_url: image_url || null,
          is_story: !!is_story,
          expires_at: is_story ? new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() : null,
        })
        .select()
        .single();
    }

    if (insertRes.error) throw insertRes.error;
    const data = insertRes.data;

    // Fetch author profile
    const { data: author } = await db
      .from('users')
      .select('id, username, display_name, avatar_url, role')
      .eq('id', user.id)
      .maybeSingle();

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
