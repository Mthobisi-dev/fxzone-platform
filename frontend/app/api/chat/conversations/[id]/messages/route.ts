import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin, getUserFromRequest, ensureUserProfile } from '@/lib/server/supabaseServer';
import { createNotification } from '@/lib/server/notifications';
import { apiError } from '@/lib/api-error';

const MESSAGE_TYPES = new Set(['text', 'image', 'video', 'audio']);
const MAX_MESSAGE_LENGTH = 10_000;
const MAX_PAGE_SIZE = 100;

// GET /api/chat/conversations/[id]/messages
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { user, error: authErr } = await getUserFromRequest(request);
    if (authErr || !user) return apiError('UNAUTHORIZED', authErr || 'Authentication required', 401);

    const { id } = await context.params;
    const db = getSupabaseAdmin(request);

    const { data: membership } = await db
      .from('conversation_members')
      .select('id, last_read_at')
      .eq('conversation_id', id)
      .eq('user_id', user.id)
      .maybeSingle();

    if (!membership) {
      return apiError('FORBIDDEN', 'Not a member of this conversation', 403);
    }

    const { searchParams } = new URL(request.url);
    const requestedLimit = Number.parseInt(searchParams.get('limit') || '50', 10);
    const requestedOffset = Number.parseInt(searchParams.get('offset') || '0', 10);
    const limit = Number.isFinite(requestedLimit) ? Math.min(Math.max(requestedLimit, 1), MAX_PAGE_SIZE) : 50;
    const offset = Number.isFinite(requestedOffset) ? Math.max(requestedOffset, 0) : 0;

    const { data, error } = await db
      .from('messages')
      .select(`
        id, conversation_id, sender_id, content, message_type, created_at,
        users:sender_id (id, username, display_name, avatar_url)
      `)
      .eq('conversation_id', id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;

    const messages = (data || []).reverse().map((m: any) => ({
      id: m.id,
      conversation_id: m.conversation_id,
      sender_id: m.sender_id,
      sender: {
        id: m.users?.id,
        username: m.users?.username,
        display_name: m.users?.display_name,
        avatar_url: m.users?.avatar_url || `https://api.dicebear.com/8.x/initials/svg?seed=${m.users?.username || 'user'}`,
      },
      content: m.content,
      message_type: m.message_type || 'text',
      created_at: m.created_at,
    }));

    const newestMessageAt = data?.[0]?.created_at;
    if (newestMessageAt && (!membership.last_read_at || newestMessageAt > membership.last_read_at)) {
      void db
        .from('conversation_members')
        .update({ last_read_at: newestMessageAt })
        .eq('conversation_id', id)
        .eq('user_id', user.id);
    }

    return NextResponse.json(messages);
  } catch (error: unknown) {
    console.error('Messages fetch error:', error);
    return apiError('INTERNAL_SERVER_ERROR', 'Unable to load messages', 500);
  }
}

// POST /api/chat/conversations/[id]/messages
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { user, error: authErr } = await getUserFromRequest(request);
    if (authErr || !user) return apiError('UNAUTHORIZED', authErr || 'Authentication required', 401);

    const { id } = await context.params;
    const db = getSupabaseAdmin(request);

    const { data: membership } = await db
      .from('conversation_members')
      .select('id')
      .eq('conversation_id', id)
      .eq('user_id', user.id)
      .maybeSingle();

    if (!membership) {
      return apiError('FORBIDDEN', 'Not a member of this conversation', 403);
    }

    const body: unknown = await request.json();
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return apiError('BAD_REQUEST', 'A JSON object is required.', 400);
    }
    const { content, message_type } = body as Record<string, unknown>;
    const normalizedMessageType = message_type || 'text';

    if (typeof content !== 'string' || !content.trim()) {
      return apiError('UNPROCESSABLE_ENTITY', 'Content is required', 422);
    }
    if (content.trim().length > MAX_MESSAGE_LENGTH) {
      return apiError('UNPROCESSABLE_ENTITY', `Messages must be at most ${MAX_MESSAGE_LENGTH} characters.`, 422);
    }
    if (typeof normalizedMessageType !== 'string' || !MESSAGE_TYPES.has(normalizedMessageType)) {
      return apiError('UNPROCESSABLE_ENTITY', 'Unsupported message type', 422);
    }

    // Ensure sender profile row exists before INSERT (FK: messages.sender_id → users.id)
    if (!await ensureUserProfile(db, user)) {
      return apiError('SERVICE_UNAVAILABLE', 'Your profile is still being provisioned. Please try again in a moment.', 503);
    }

    const { data, error } = await db
      .from('messages')
      .insert({
        conversation_id: id,
        sender_id: user.id,
        content: content.trim(),
        message_type: normalizedMessageType,
      })
      .select()
      .single();

    if (error) throw error;

    await db
      .from('conversations')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', id);

    const { data: recipients } = await db
      .from('conversation_members')
      .select('user_id')
      .eq('conversation_id', id)
      .neq('user_id', user.id);
    const { data: sender } = await db
      .from('users')
      .select('id, username, display_name, avatar_url')
      .eq('id', user.id)
      .maybeSingle();

    const senderName = sender?.display_name || sender?.username || user.email?.split('@')[0] || 'A trader';
    await Promise.all((recipients || []).map((recipient: { user_id: string }) =>
      createNotification(db, {
        recipientId: recipient.user_id,
        actorId: user.id,
        type: 'message',
        title: `New message from ${senderName}`,
        message: content.trim().slice(0, 140),
        data: { conversation_id: id, message_id: data.id },
      })
    ));

    return NextResponse.json({
      ...data,
      sender: {
        id: sender?.id || user.id,
        username: sender?.username || user.email?.split('@')[0],
        display_name: sender?.display_name || '',
        avatar_url: sender?.avatar_url || null,
      },
    }, { status: 201 });
  } catch (error: unknown) {
    console.error('Send message error:', error);
    return apiError('INTERNAL_SERVER_ERROR', 'Unable to send message', 500);
  }
}
