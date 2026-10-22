import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin, getUserFromRequest, ensureUserProfile } from '@/lib/server/supabaseServer';
import { apiError } from '@/lib/api-error';

const MAX_CONVERSATION_MEMBERS = 50;
const MAX_GROUP_NAME_LENGTH = 120;

// GET /api/chat/conversations — list conversations for current user
export async function GET(request: NextRequest) {
  try {
    const { user, error: authErr } = await getUserFromRequest(request);
    if (authErr || !user) return apiError('UNAUTHORIZED', authErr || 'Authentication required', 401);

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
    const conversationsResult = await db
      .from('conversations')
      .select(`
        id,
        name,
        description,
        is_group,
        creator_id,
        created_at,
        updated_at,
        canonical_conversation_id
      `)
      .in('id', convIds)
      .order('updated_at', { ascending: false });

    let hasCanonicalChatMigration = true;
    let conversations: any[] | null = conversationsResult.data;
    let conversationError = conversationsResult.error;
    if (conversationsResult.error?.code === '42703' && conversationsResult.error.message.includes('canonical_conversation_id')) {
      // Preserve all existing history until the one-time merge migration is applied.
      hasCanonicalChatMigration = false;
      const fallback = await db
        .from('conversations')
        .select('id,name,description,is_group,creator_id,created_at,updated_at')
        .in('id', convIds)
        .order('updated_at', { ascending: false });
      conversations = fallback.data;
      conversationError = fallback.error;
    }
    if (conversationError) throw conversationError;

    // Batch: fetch all members for all conversations in ONE query (not N queries)
    const { data: allMembers, error: allMembersError } = await db
      .from('conversation_members')
      .select(`
        conversation_id,
        users:user_id (id, username, display_name, avatar_url)
      `)
      .in('conversation_id', convIds);
    if (allMembersError) throw allMembersError;

    const { data: latestMessages, error: latestMessagesError } = await db
      .from('messages')
      .select('conversation_id, created_at')
      .in('conversation_id', convIds)
      .order('created_at', { ascending: false });
    if (latestMessagesError) throw latestMessagesError;
    const latestByConversation = new Map<string, string>();
    for (const message of latestMessages || []) {
      if (!latestByConversation.has(message.conversation_id)) latestByConversation.set(message.conversation_id, message.created_at);
    }

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

    // Enrich conversations without per-item DB calls. Older deployments may
    // contain duplicate direct-chat rows, so return one stable (oldest) thread
    // for each unordered pair even before the data-consolidation migration runs.
    const visibleConversations = (conversations || []).filter((conv: any) => !conv.canonical_conversation_id);
    const orderedConversations = [...visibleConversations].sort((a: any, b: any) =>
      String(a.created_at).localeCompare(String(b.created_at)) || String(a.id).localeCompare(String(b.id)),
    );
    const seenDirectPairs = new Set<string>();
    const enriched = orderedConversations.flatMap((conv: any) => {
      const membership = memberships.find((m: any) => m.conversation_id === conv.id);
      const members = membersByConvId[conv.id] || [];
      if (hasCanonicalChatMigration && !conv.is_group && members.length === 2) {
        const pairKey = members.map((member: any) => String(member.id)).sort().join(':');
        if (seenDirectPairs.has(pairKey)) return [];
        seenDirectPairs.add(pairKey);
      }
      return [{
        id: conv.id,
        name: conv.name,
        description: conv.description,
        is_group: conv.is_group,
        creator_id: conv.creator_id,
        created_at: conv.created_at,
        updated_at: conv.updated_at,
        members,
        unread_count: (() => {
          const latest = latestByConversation.get(conv.id);
          const lastRead = membership?.last_read_at;
          return latest && (!lastRead || latest > lastRead) ? 1 : 0;
        })(),
        last_read_at: membership?.last_read_at || null,
      }];
    }).sort((a: any, b: any) => String(b.updated_at).localeCompare(String(a.updated_at)));

    return NextResponse.json(enriched);
  } catch (error: unknown) {
    console.error('Conversations fetch error:', error);
    return apiError('INTERNAL_SERVER_ERROR', 'Unable to load conversations', 500);
  }
}

// POST /api/chat/conversations — create a new conversation
export async function POST(request: NextRequest) {
  try {
    const { user, error: authErr } = await getUserFromRequest(request);
    if (authErr || !user) return apiError('UNAUTHORIZED', authErr || 'Authentication required', 401);

    const db = getSupabaseAdmin(request);
    const body: unknown = await request.json();
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return apiError('BAD_REQUEST', 'A JSON object is required.', 400);
    }
    const { participant_ids, is_group, name } = body as Record<string, unknown>;

    if (!Array.isArray(participant_ids) || participant_ids.length === 0 || participant_ids.length > MAX_CONVERSATION_MEMBERS || participant_ids.some((id: unknown) => typeof id !== 'string' || !id.trim() || id.trim().length > 64)) {
      return apiError('UNPROCESSABLE_ENTITY', `participant_ids must contain between 1 and ${MAX_CONVERSATION_MEMBERS} user IDs.`, 422);
    }
    if (name !== undefined && (typeof name !== 'string' || name.trim().length > MAX_GROUP_NAME_LENGTH)) {
      return apiError('UNPROCESSABLE_ENTITY', `Conversation name must be at most ${MAX_GROUP_NAME_LENGTH} characters.`, 422);
    }

    // Ensure creator's profile exists for FK references.
    if (!await ensureUserProfile(db, user)) {
      return apiError('SERVICE_UNAVAILABLE', 'Your profile is still being provisioned. Please try again in a moment.', 503);
    }

    const allMemberIds = Array.from(new Set([user.id, ...participant_ids.filter((id: string) => id !== user.id)]));
    const { data: registeredMembers, error: memberLookupError } = await db
      .from('users')
      .select('id')
      .in('id', allMemberIds);
    if (memberLookupError) throw memberLookupError;
    if ((registeredMembers || []).length !== allMemberIds.length) {
      return apiError('UNPROCESSABLE_ENTITY', 'One or more selected chat members no longer exist.', 422);
    }

    if (is_group !== true) {
      if (allMemberIds.length !== 2) return apiError('UNPROCESSABLE_ENTITY', 'Select exactly one other user for a direct chat.', 422);
      const { data: conversation, error } = await db.rpc('get_or_create_direct_conversation', {
        p_user: user.id, p_other: allMemberIds.find(id => id !== user.id),
      });
      if (error) throw error;
      return NextResponse.json({ ...conversation, members: allMemberIds });
    }

    // Create new conversation
    const { data: conv, error: convError } = await db
      .from('conversations')
      .insert({
        name: typeof name === 'string' ? name.trim() || null : null,
        is_group: is_group === true,
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
  } catch (error: unknown) {
    console.error('Create conversation error:', error);
    return apiError('INTERNAL_SERVER_ERROR', 'Unable to create conversation', 500);
  }
}
