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
