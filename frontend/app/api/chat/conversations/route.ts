import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';



async function getUser(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const token = authHeader?.replace('Bearer ', '');
  if (!token) return null;
  const { data: { user } } = await supabaseAdmin.auth.getUser(token);
  return user;
}

// GET /api/chat/conversations — list conversations for current user
export async function GET(request: NextRequest) {
  try {
    const user = await getUser(request);
    if (!user) return NextResponse.json([], { status: 200 });

    // Get conversation IDs user is a member of
    const { data: memberships, error: memberError } = await supabaseAdmin
      .from('conversation_members')
      .select('conversation_id, last_read_at, joined_at')
      .eq('user_id', user.id);

    if (memberError) throw memberError;
    if (!memberships || memberships.length === 0) return NextResponse.json([]);

    const convIds = memberships.map((m: any) => m.conversation_id);

    // Fetch conversation details
    const { data: conversations, error: convError } = await supabaseAdmin
      .from('conversations')
      .select(`
        id,
        name,
        is_group,
        created_at,
        updated_at
      `)
      .in('id', convIds)
      .order('updated_at', { ascending: false });

    if (convError) throw convError;

    // Fetch members for each conversation
    const enriched = await Promise.all(
      (conversations || []).map(async (conv: any) => {
        const { data: members } = await supabaseAdmin
          .from('conversation_members')
          .select(`
            user_id,
            users:user_id (id, username, display_name, avatar_url)
          `)
          .eq('conversation_id', conv.id);

        const memberData = (members || []).map((m: any) => m.users).filter(Boolean);

        // Unread count = messages after last_read_at
        const membership = memberships.find((m: any) => m.conversation_id === conv.id);
        let unread_count = 0;
        if (membership?.last_read_at) {
          const { count } = await supabaseAdmin
            .from('messages')
            .select('id', { count: 'exact', head: true })
            .eq('conversation_id', conv.id)
            .neq('sender_id', user.id)
            .gt('created_at', membership.last_read_at);
          unread_count = count || 0;
        }

        return {
          id: conv.id,
          name: conv.name,
          is_group: conv.is_group,
          created_at: conv.created_at,
          updated_at: conv.updated_at,
          members: memberData,
          unread_count,
        };
      })
    );

    return NextResponse.json(enriched);
  } catch (error: any) {
    console.error('Conversations fetch error:', error);
    return NextResponse.json([], { status: 200 });
  }
}

// POST /api/chat/conversations — create a new conversation
export async function POST(request: NextRequest) {
  try {
    const user = await getUser(request);
    if (!user) return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });

    const body = await request.json();
    const { participant_ids, is_group, name } = body;

    if (!participant_ids || participant_ids.length === 0) {
      return NextResponse.json({ detail: 'participant_ids required' }, { status: 400 });
    }

    const allMemberIds: string[] = [user.id, ...participant_ids.filter((id: string) => id !== user.id)];

    // For 1-on-1 chats, check if a conversation already exists
    if (!is_group && allMemberIds.length === 2) {
      const otherId = allMemberIds.find(id => id !== user.id);
      const { data: myConvs } = await supabaseAdmin
        .from('conversation_members')
        .select('conversation_id')
        .eq('user_id', user.id);

      if (myConvs && myConvs.length > 0) {
        const myConvIds = myConvs.map((c: any) => c.conversation_id);
        const { data: shared } = await supabaseAdmin
          .from('conversation_members')
          .select('conversation_id')
          .eq('user_id', otherId)
          .in('conversation_id', myConvIds);

        if (shared && shared.length > 0) {
          // Return existing conversation
          const { data: existing } = await supabaseAdmin
            .from('conversations')
            .select('*')
            .eq('id', shared[0].conversation_id)
            .eq('is_group', false)
            .single();
          if (existing) {
            return NextResponse.json({ ...existing, members: allMemberIds });
          }
        }
      }
    }

    // Create new conversation
    const { data: conv, error: convError } = await supabaseAdmin
      .from('conversations')
      .insert({
        name: name || null,
        is_group: !!is_group,
        creator_id: user.id,
      })
      .select()
      .single();

    if (convError) throw convError;

    // Add all members
    const memberInserts = allMemberIds.map(uid => ({
      conversation_id: conv.id,
      user_id: uid,
    }));
    await supabaseAdmin.from('conversation_members').insert(memberInserts);

    return NextResponse.json({ ...conv, members: allMemberIds }, { status: 201 });
  } catch (error: any) {
    console.error('Create conversation error:', error);
    return NextResponse.json(
      { error: 'Failed to create conversation', detail: error?.message },
      { status: 500 }
    );
  }
}
