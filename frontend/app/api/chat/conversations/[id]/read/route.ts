import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin, getUserFromRequest } from '@/lib/server/supabaseServer';
import { apiError } from '@/lib/api-error';

/**
 * Mark a conversation read for the current member.
 *
 * This is deliberately a conversation-scoped operation instead of a client
 * loop over individual notification ids. It keeps the chat list, footer badge,
 * and notification dropdown in sync when several messages arrived together.
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { user, error: authError } = await getUserFromRequest(request);
    if (authError || !user) return apiError('UNAUTHORIZED', 'Authentication required.', 401);

    const { id: conversationId } = await context.params;
    if (!conversationId || conversationId.length > 64) {
      return apiError('BAD_REQUEST', 'A valid conversation id is required.', 400);
    }

    const db = getSupabaseAdmin(request);
    const { data: membership, error: membershipError } = await db
      .from('conversation_members')
      .select('id, last_read_at')
      .eq('conversation_id', conversationId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (membershipError) throw membershipError;
    if (!membership) return apiError('FORBIDDEN', 'Not a member of this conversation', 403);

    const { data: latestMessage, error: latestMessageError } = await db
      .from('messages')
      .select('created_at')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (latestMessageError) throw latestMessageError;

    const readAt = latestMessage?.created_at || membership.last_read_at || new Date().toISOString();
    if (!membership.last_read_at || readAt > membership.last_read_at) {
      const { error: readError } = await db
        .from('conversation_members')
        .update({ last_read_at: readAt })
        .eq('conversation_id', conversationId)
        .eq('user_id', user.id);
      if (readError) throw readError;
    }

    // Message notifications store the conversation id in their JSON payload.
    // The recipient filter is mandatory so a malformed payload cannot clear
    // another user's notifications.
    const { error: notificationError } = await db
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', user.id)
      .eq('type', 'message')
      .eq('is_read', false)
      .contains('data', { conversation_id: conversationId });

    if (notificationError) throw notificationError;

    return NextResponse.json({ conversation_id: conversationId, read_at: readAt });
  } catch (error: unknown) {
    console.error('Conversation read-state update error:', error);
    return apiError('INTERNAL_SERVER_ERROR', 'Unable to update conversation read state.', 500);
  }
}
