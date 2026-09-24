import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin, getUserFromRequest, ensureUserProfile } from '@/lib/server/supabaseServer';

// GET /api/chat/conversations — list conversations for current user
export async function GET(request: NextRequest) {
  try {
    const { user, error: authErr } = await getUserFromRequest(request);
    if (authErr || !user) return NextResponse.json([], { status: 200 });

    const db = getSupabaseAdmin(request);

    // Get all membership data in one query with conversation details
    const { data: memberships, error: memberError } = await db
      .from('conversation_members')
      .select('conversation_id, last_read_at, joined_at')
      .eq('user_id', user.id);

    if (memberError) throw memberError;
    if (!memberships || memberships.length === 0) return NextResponse.json([]);

    const convIds = memberships.map((m: any) => m.conversation_id);

    // Batch: fetch all conversations in one query
    const { data: conversations, error: convError } = await db
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

    // Batch: fetch all members for all conversations in ONE query (not N queries)
    const { data: allMembers } = await db
      .from('conversation_members')
      .select(`
        conversation_id,
        users:user_id (id, username, display_name, avatar_url)
      `)
      .in('conversation_id', convIds);

    // Build a map of conversationId → members[]
    const membersByConvId: Record<string, any[]> = {};
    (allMembers || []).forEach((m: any) => {
      if (!membersByConvId[m.conversation_id]) {
        membersByConvId[m.conversation_id] = [];
      }
      if (m.users) {
        membersByConvId[m.conversation_id].push(m.users);
      }
    });

    // Enrich conversations without per-item DB calls
    const enriched = (conversations || []).map((conv: any) => {
      const membership = memberships.find((m: any) => m.conversation_id === conv.id);
      return {
        id: conv.id,
        name: conv.name,
        is_group: conv.is_group,
        created_at: conv.created_at,
        updated_at: conv.updated_at,
        members: membersByConvId[conv.id] || [],
        // Unread count is computed client-side from Realtime state; skip expensive per-conv COUNT query
        unread_count: 0,
        last_read_at: membership?.last_read_at || null,
      };
    });

    return NextResponse.json(enriched);
  } catch (error: any) {
    console.error('Conversations fetch error:', error);
    return NextResponse.json([], { status: 200 });
  }
}

// POST /api/chat/conversations — create a new conversation
export async function POST(request: NextRequest) {
  try {
    const { user, error: authErr } = await getUserFromRequest(request);
    if (authErr || !user) return NextResponse.json({ detail: authErr || 'Not authenticated' }, { status: 401 });

    const db = getSupabaseAdmin(request);
    const body = await request.json();
    const { participant_ids, is_group, name } = body;

    if (!Array.isArray(participant_ids) || participant_ids.length === 0 || participant_ids.some((id: unknown) => typeof id !== 'string' || !id.trim())) {
      return NextResponse.json({ detail: 'participant_ids must contain at least one user ID.' }, { status: 400 });
    }

    // Ensure creator's profile exists for FK references.
    if (!await ensureUserProfile(db, user)) {
      return NextResponse.json({ detail: 'Your profile is still being provisioned. Please try again in a moment.' }, { status: 503 });
    }

    const allMemberIds = Array.from(new Set([user.id, ...participant_ids.filter((id: string) => id !== user.id)]));
    const { data: registeredMembers, error: memberLookupError } = await db
      .from('users')
      .select('id')
      .in('id', allMemberIds);
    if (memberLookupError) throw memberLookupError;
    if ((registeredMembers || []).length !== allMemberIds.length) {
      return NextResponse.json({ detail: 'One or more selected chat members no longer exist.' }, { status: 400 });
    }

    // For 1-on-1 chats, check if a conversation already exists
    if (!is_group && allMemberIds.length === 2) {
      const otherId = allMemberIds.find(id => id !== user.id);
      const { data: myConvs } = await db
        .from('conversation_members')
        .select('conversation_id')
        .eq('user_id', user.id);

      if (myConvs && myConvs.length > 0) {
        const myConvIds = myConvs.map((c: any) => c.conversation_id);
        const { data: shared } = await db
          .from('conversation_members')
          .select('conversation_id')
          .eq('user_id', otherId)
          .in('conversation_id', myConvIds);

        if (shared && shared.length > 0) {
          const { data: existing } = await db
            .from('conversations')
            .select('*')
            .eq('id', shared[0].conversation_id)
            .eq('is_group', false)
            .maybeSingle();
          if (existing) {
            return NextResponse.json({ ...existing, members: allMemberIds });
          }
        }
      }
    }

    // Create new conversation
    const { data: conv, error: convError } = await db
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
    const { error: memberInsertError } = await db.from('conversation_members').insert(memberInserts);
    if (memberInsertError) {
      await db.from('conversations').delete().eq('id', conv.id);
      throw memberInsertError;
    }

    return NextResponse.json({ ...conv, members: allMemberIds }, { status: 201 });
  } catch (error: any) {
    console.error('Create conversation error:', error);
    return NextResponse.json(
      { error: 'Failed to create conversation', detail: error?.message },
      { status: 500 }
    );
  }
}
