import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin, getUserFromRequest } from '@/lib/supabase';

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { user, error: authError } = await getUserFromRequest(request);
    if (authError || !user) return NextResponse.json({ detail: authError || 'Not authenticated' }, { status: 401 });
    const { id } = await context.params;
    const db = getSupabaseAdmin(request);
    const { data: membership } = await db
      .from('conversation_members')
      .select('conversation_id, last_read_at')
      .eq('conversation_id', id)
      .eq('user_id', user.id)
      .maybeSingle();
    if (!membership) return NextResponse.json({ detail: 'Conversation not found' }, { status: 404 });

    const [{ data: conversation, error: conversationError }, { data: members, error: membersError }] = await Promise.all([
      db.from('conversations').select('id, name, is_group, created_at, updated_at').eq('id', id).single(),
      db.from('conversation_members').select('user_id, users:user_id (id, username, display_name, avatar_url)').eq('conversation_id', id),
    ]);
    if (conversationError || !conversation) return NextResponse.json({ detail: 'Conversation not found' }, { status: 404 });
    if (membersError) throw membersError;

    return NextResponse.json({
      ...conversation,
      last_read_at: membership.last_read_at || null,
      unread_count: 0,
      members: (members || []).map((member: any) => member.users).filter(Boolean),
    });
  } catch (error: any) {
    return NextResponse.json({ detail: error?.message || 'Unable to load conversation' }, { status: 500 });
  }
}

/**
 * Hide a conversation for the authenticated user by removing only their
 * membership. This deliberately never deletes the conversation or another
 * participant's messages.
 */
export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { user, error: authError } = await getUserFromRequest(request);
    if (authError || !user) return NextResponse.json({ detail: 'Authentication required' }, { status: 401 });
    const { id } = await context.params;
    if (!id || !/^[0-9a-f-]{36}$/i.test(id)) {
      return NextResponse.json({ detail: 'Invalid conversation id' }, { status: 400 });
    }
    const db = getSupabaseAdmin(request);
    const { data: membership, error: membershipError } = await db
      .from('conversation_members')
      .select('conversation_id')
      .eq('conversation_id', id)
      .eq('user_id', user.id)
      .maybeSingle();
    if (membershipError) throw membershipError;
    if (!membership) return NextResponse.json({ detail: 'Conversation not found' }, { status: 404 });

    const { error: deleteError } = await db
      .from('conversation_members')
      .delete()
      .eq('conversation_id', id)
      .eq('user_id', user.id);
    if (deleteError) throw deleteError;
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error('Failed to remove conversation for user', error);
    return NextResponse.json({ detail: 'Unable to remove conversation' }, { status: 500 });
  }
}
