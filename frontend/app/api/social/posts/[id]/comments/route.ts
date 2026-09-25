import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin, getUserFromRequest, ensureUserProfile } from '@/lib/server/supabaseServer';


// GET /api/social/posts/[id]/comments
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const db = getSupabaseAdmin(request);

    const { data, error } = await db
      .from('comments')
      .select(`
        id, post_id, user_id, content, parent_id, created_at,
        users:user_id (id, username, display_name, avatar_url, role)
      `)
      .eq('post_id', id)
      .is('parent_id', null)
      .order('created_at', { ascending: true });

    if (error) throw error;

    const comments = (data || []).map((c: any) => ({
      id: c.id,
      post_id: c.post_id,
      user_id: c.user_id,
      user: {
        id: c.users?.id,
        username: c.users?.username,
        display_name: c.users?.display_name,
        avatar_url: c.users?.avatar_url || `https://api.dicebear.com/8.x/initials/svg?seed=${c.users?.username || 'user'}`,
        role: c.users?.role,
      },
      content: c.content,
      parent_id: c.parent_id,
      created_at: c.created_at,
    }));

    return NextResponse.json(comments);
  } catch (error: any) {
    return NextResponse.json({ error: 'Failed to fetch comments', detail: error?.message }, { status: 500 });
  }
}

// POST /api/social/posts/[id]/comments
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { user, error: authErr } = await getUserFromRequest(request);
    if (authErr || !user) return NextResponse.json({ detail: authErr || 'Not authenticated' }, { status: 401 });

    const { id } = await context.params;
    const body = await request.json();
    const { content, parent_id } = body;

    if (!content?.trim()) {
      return NextResponse.json({ detail: 'Content is required' }, { status: 400 });
    }

    const db = getSupabaseAdmin(request);
    if (!await ensureUserProfile(db, user)) {
      return NextResponse.json({ detail: 'Your profile is still being provisioned. Please try again in a moment.' }, { status: 503 });
    }

    const { data, error } = await db
      .from('comments')
      .insert({
        post_id: id,
        user_id: user.id,
        content: content.trim(),
        parent_id: parent_id || null,
      })
      .select()
      .single();

    if (error) throw error;

    const { data: author } = await db
      .from('users')
      .select('id, username, display_name, avatar_url')
      .eq('id', user.id)
      .maybeSingle();

    return NextResponse.json({
      ...data,
      user: {
        id: author?.id || user.id,
        username: author?.username || user.email?.split('@')[0],
        display_name: author?.display_name || '',
        avatar_url: author?.avatar_url || null,
      },
    }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: 'Failed to post comment', detail: error?.message }, { status: 500 });
  }
}
