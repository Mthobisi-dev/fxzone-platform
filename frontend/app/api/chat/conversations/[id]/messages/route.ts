import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin, getUserFromRequest, ensureUserProfile } from '@/lib/server/supabaseServer';
import { createNotification } from '@/lib/server/notifications';

// GET /api/chat/conversations/[id]/messages
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { user, error: authErr } = await getUserFromRequest(request);
    if (authErr || !user) return NextResponse.json([], { status: 200 });

    const { id } = await context.params;
    const db = getSupabaseAdmin(request);

    const { data: membership } = await db
      .from('conversation_members')
      .select('id, last_read_at')
      .eq('conversation_id', id)
      .eq('user_id', user.id)
      .maybeSingle();

    if (!membership) {
      return NextResponse.json({ detail: 'Not a member of this conversation' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

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
  } catch (error: any) {
    console.error('Messages fetch error:', error);
    return NextResponse.json([], { status: 200 });
  }
}

// POST /api/chat/conversations/[id]/messages
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { user, error: authErr } = await getUserFromRequest(request);
    if (authErr || !user) return NextResponse.json({ detail: authErr || 'Not authenticated' }, { status: 401 });

    const { id } = await context.params;
    const db = getSupabaseAdmin(request);

    const { data: membership } = await db
      .from('conversation_members')
      .select('id')
      .eq('conversation_id', id)
      .eq('user_id', user.id)
      .maybeSingle();

    if (!membership) {
      return NextResponse.json({ detail: 'Not a member of this conversation' }, { status: 403 });
    }

    const body = await request.json();
    const { content, message_type } = body;

    if (!content?.trim()) {
      return NextResponse.json({ detail: 'Content is required' }, { status: 400 });
    }

    // Ensure sender profile row exists before INSERT (FK: messages.sender_id → users.id)
    if (!await ensureUserProfile(db, user)) {
      return NextResponse.json({ detail: 'Your profile is still being provisioned. Please try again in a moment.' }, { status: 503 });
    }

    const { data, error } = await db
      .from('messages')
      .insert({
        conversation_id: id,
        sender_id: user.id,
        content: content.trim(),
        message_type: message_type || 'text',
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
  } catch (error: any) {
    console.error('Send message error:', error);
    return NextResponse.json(
      { error: 'Failed to send message', detail: error?.message },
      { status: 500 }
    );
  }
}
