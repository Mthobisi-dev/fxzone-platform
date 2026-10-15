import { NextRequest, NextResponse } from 'next/server';
import { apiError } from '@/lib/api-error';
import { canDeleteMessage } from '@/lib/chatMessagePolicy';
import { getSupabaseAdmin, getUserFromRequest } from '@/lib/server/supabaseServer';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** DELETE /api/chat/conversations/[id]/messages/[messageId] */
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string; messageId: string }> },
) {
  try {
    const { user, error: authError } = await getUserFromRequest(request);
    if (authError || !user) return apiError('UNAUTHORIZED', 'Authentication required', 401);

    const { id: conversationId, messageId } = await context.params;
    if (!UUID_PATTERN.test(conversationId) || !UUID_PATTERN.test(messageId)) {
      return apiError('BAD_REQUEST', 'A valid conversation and message ID are required.', 400);
    }

    const db = getSupabaseAdmin(request);
    const { data: membership, error: membershipError } = await db
      .from('conversation_members')
      .select('id')
      .eq('conversation_id', conversationId)
      .eq('user_id', user.id)
      .maybeSingle();
    if (membershipError) throw membershipError;
    if (!membership) return apiError('FORBIDDEN', 'You are not a member of this conversation.', 403);

    const { data: message, error: messageError } = await db
      .from('messages')
      .select('id, conversation_id, sender_id')
      .eq('id', messageId)
      .eq('conversation_id', conversationId)
      .maybeSingle();
    if (messageError) throw messageError;
    // A retry after a lost response should still succeed once the row is gone.
    if (!message) return NextResponse.json({ success: true, id: messageId });
    if (!canDeleteMessage(message, user.id, conversationId)) {
      return apiError('FORBIDDEN', 'You can delete only messages you sent.', 403);
    }

    const { error: deleteError } = await db
      .from('messages')
      .delete()
      .eq('id', messageId)
      .eq('conversation_id', conversationId)
      .eq('sender_id', user.id)
      .select('id')
      .maybeSingle();
    if (deleteError) throw deleteError;

    return NextResponse.json({ success: true, id: messageId });
  } catch (error: unknown) {
    console.error('Chat message delete error:', error);
    return apiError('INTERNAL_SERVER_ERROR', 'Unable to delete this message.', 500);
  }
}
