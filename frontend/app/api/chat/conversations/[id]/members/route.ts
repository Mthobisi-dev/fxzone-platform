import { NextRequest, NextResponse } from 'next/server';
import { apiError } from '@/lib/api-error';
import { getSupabaseAdmin, getUserFromRequest } from '@/lib/server/supabaseServer';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function getGroupAdmin(db: ReturnType<typeof getSupabaseAdmin>, conversationId: string, userId: string) {
  const [{ data: conversation, error: conversationError }, { data: membership, error: membershipError }] = await Promise.all([
    db.from('conversations').select('id, is_group, creator_id').eq('id', conversationId).maybeSingle(),
    db.from('conversation_members').select('id').eq('conversation_id', conversationId).eq('user_id', userId).maybeSingle(),
  ]);
  if (conversationError) throw conversationError;
  if (membershipError) throw membershipError;
  if (!conversation || !conversation.is_group || !membership) return null;
  return String(conversation.creator_id) === String(userId) ? conversation : null;
}

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { user, error: authError } = await getUserFromRequest(request);
    if (authError || !user) return apiError('UNAUTHORIZED', 'Authentication required', 401);
    const { id } = await context.params;
    if (!UUID.test(id)) return apiError('BAD_REQUEST', 'Invalid conversation id.', 400);
    const db = getSupabaseAdmin(request);
    if (!await getGroupAdmin(db, id, user.id)) return apiError('FORBIDDEN', 'Only the group creator can manage members.', 403);
    const body = await request.json().catch(() => null) as Record<string, unknown> | null;
    const ids = Array.isArray(body?.user_ids) ? Array.from(new Set(body.user_ids.filter((value): value is string => typeof value === 'string' && UUID.test(value)))) : [];
    if (!ids.length || ids.length > 50) return apiError('UNPROCESSABLE_ENTITY', 'Provide one to 50 valid user IDs.', 422);
    const { data: users, error: usersError } = await db.from('users').select('id').in('id', ids);
    if (usersError) throw usersError;
    if ((users || []).length !== ids.length) return apiError('UNPROCESSABLE_ENTITY', 'One or more users no longer exist.', 422);
    const { error } = await db.from('conversation_members').upsert(ids.map(userId => ({ conversation_id: id, user_id: userId })), { onConflict: 'conversation_id,user_id', ignoreDuplicates: true });
    if (error) throw error;
    return NextResponse.json({ added: ids }, { status: 201 });
  } catch (error) {
    console.error('Group member add error:', error);
    return apiError('INTERNAL_SERVER_ERROR', 'Unable to add group members.', 500);
  }
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { user, error: authError } = await getUserFromRequest(request);
    if (authError || !user) return apiError('UNAUTHORIZED', 'Authentication required', 401);
    const { id } = await context.params;
    const targetId = new URL(request.url).searchParams.get('user_id') || '';
    if (!UUID.test(id) || !UUID.test(targetId)) return apiError('BAD_REQUEST', 'Valid conversation and user IDs are required.', 400);
    const db = getSupabaseAdmin(request);
    if (!await getGroupAdmin(db, id, user.id)) return apiError('FORBIDDEN', 'Only the group creator can manage members.', 403);
    if (targetId === user.id) return apiError('UNPROCESSABLE_ENTITY', 'The group creator cannot be removed.', 422);
    const { error } = await db.from('conversation_members').delete().eq('conversation_id', id).eq('user_id', targetId);
    if (error) throw error;
    return NextResponse.json({ removed: targetId });
  } catch (error) {
    console.error('Group member remove error:', error);
    return apiError('INTERNAL_SERVER_ERROR', 'Unable to remove group member.', 500);
  }
}
