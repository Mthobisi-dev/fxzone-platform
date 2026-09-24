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
