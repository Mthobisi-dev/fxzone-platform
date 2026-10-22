import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin, getUserFromRequest } from '@/lib/server/supabaseServer';
import { apiError } from '@/lib/api-error';

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
      db.from('conversations').select('id, name, description, is_group, creator_id, created_at, updated_at').eq('id', id).single(),
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

/** Update group settings. Only the conversation creator can change them. */
export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { user, error: authError } = await getUserFromRequest(request);
    if (authError || !user) return apiError('UNAUTHORIZED', 'Authentication required', 401);
    const { id } = await context.params;
    const db = getSupabaseAdmin(request);
    const { data: membership } = await db.from('conversation_members').select('id').eq('conversation_id', id).eq('user_id', user.id).maybeSingle();
    if (!membership) return apiError('NOT_FOUND', 'Conversation not found', 404);
    const { data: conversation, error: lookupError } = await db.from('conversations').select('id, is_group, creator_id').eq('id', id).maybeSingle();
    if (lookupError) throw lookupError;
    if (!conversation || !conversation.is_group) return apiError('UNPROCESSABLE_ENTITY', 'Only group conversations have editable settings.', 422);
    if (String(conversation.creator_id) !== String(user.id)) return apiError('FORBIDDEN', 'Only the group creator can change settings.', 403);
    const body = await request.json().catch(() => null) as Record<string, unknown> | null;
    const name = typeof body?.name === 'string' ? body.name.trim().slice(0, 120) : '';
    const description = typeof body?.description === 'string' ? body.description.trim().slice(0, 500) : null;
    if (!name) return apiError('UNPROCESSABLE_ENTITY', 'A group name is required.', 422);
    const { data, error } = await db.from('conversations').update({ name, description, updated_at: new Date().toISOString() }).eq('id', id).select('id, name, description, is_group, creator_id, updated_at').single();
    if (error) throw error;
    return NextResponse.json(data);
  } catch (error) {
    console.error('Group settings update error:', error);
    return apiError('INTERNAL_SERVER_ERROR', 'Unable to update group settings.', 500);
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
