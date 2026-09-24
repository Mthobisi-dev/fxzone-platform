import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin, getUserFromRequest, ensureUserProfile } from '@/lib/server/supabaseServer';

// POST /api/social/posts/[id]/react — toggle like/reaction
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { user, error: authErr } = await getUserFromRequest(request);
    if (authErr || !user) {
      return NextResponse.json({ detail: authErr || 'Not authenticated' }, { status: 401 });
    }

    const { id } = await context.params;
    const body = await request.json();
    const reactionType = body.reaction_type || 'like';

    const db = getSupabaseAdmin(request);

    // Ensure profile row exists before writing (reactions has FK to users)
    await ensureUserProfile(db, user);

    // Check if reaction exists
    const { data: existing, error: existingError } = await db
      .from('reactions')
      .select('id')
      .eq('post_id', id)
      .eq('user_id', user.id)
      .eq('reaction_type', reactionType)
      .maybeSingle();
    if (existingError) throw existingError;

    let active: boolean;

    if (existing) {
      const { error } = await db.from('reactions').delete().eq('id', existing.id);
      if (error) throw error;
      active = false;
    } else {
      const { error } = await db.from('reactions').insert({
        post_id: id,
        user_id: user.id,
        reaction_type: reactionType,
      });
      if (error) throw error;
      active = true;
    }

    // The database trigger updates the counter atomically. Read the resulting
    // value instead of racing a client-side count/update sequence.
    const { data: post, error: postError } = await db
      .from('posts')
      .select('likes_count')
      .eq('id', id)
      .maybeSingle();
    if (postError || !post) return NextResponse.json({ detail: 'Post not found' }, { status: 404 });

    const likes_count = post.likes_count || 0;

    return NextResponse.json({ active, likes_count, reaction_type: reactionType });
  } catch (error: any) {
    console.error('React error:', error);
    return NextResponse.json({ error: 'Failed to react', detail: error?.message }, { status: 500 });
  }
}
