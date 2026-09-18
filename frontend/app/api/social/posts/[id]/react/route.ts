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

// POST /api/social/posts/[id]/react — toggle like/reaction
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUser(request);
    if (!user) return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });

    const { id } = await context.params;
    const body = await request.json();
    const reactionType = body.reaction_type || 'like';

    // Check if reaction exists
    const { data: existing } = await supabaseAdmin
      .from('reactions')
      .select('id')
      .eq('post_id', id)
      .eq('user_id', user.id)
      .eq('reaction_type', reactionType)
      .single();

    let active: boolean;

    if (existing) {
      await supabaseAdmin.from('reactions').delete().eq('id', existing.id);
      active = false;
    } else {
      await supabaseAdmin.from('reactions').insert({
        post_id: id,
        user_id: user.id,
        reaction_type: reactionType,
      });
      active = true;
    }

    // Get updated likes count
    const { count } = await supabaseAdmin
      .from('reactions')
      .select('id', { count: 'exact', head: true })
      .eq('post_id', id)
      .eq('reaction_type', 'like');

    const likes_count = count || 0;

    await supabaseAdmin
      .from('posts')
      .update({ likes_count })
      .eq('id', id);

    return NextResponse.json({ active, likes_count, reaction_type: reactionType });
  } catch (error: any) {
    console.error('React error:', error);
    return NextResponse.json({ error: 'Failed to react', detail: error?.message }, { status: 500 });
  }
}
