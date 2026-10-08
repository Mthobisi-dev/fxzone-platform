import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin, getUserFromRequest } from '@/lib/supabase';
import { apiError } from '@/lib/api-error';

// Read admission state without rejoining or overwriting the host's decision.
export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { user, error } = await getUserFromRequest(request);
    if (error || !user) return apiError('UNAUTHORIZED', 'Authentication required', 401);
    const { id } = await context.params;
    const db = getSupabaseAdmin(request);
    const { data: participant, error: participantError } = await db
      .from('session_participants')
      .select('id, user_id, session_id, role, left_at')
      .eq('session_id', id)
      .eq('user_id', user.id)
      .maybeSingle();
    if (participantError) throw participantError;
    if (!participant) return apiError('NOT_FOUND', 'Join this session first.', 404);
    const { data: session, error: sessionError } = await db.from('live_sessions')
      .select('status, viewer_count').eq('id', id).maybeSingle();
    if (sessionError) throw sessionError;
    if (!session) return apiError('NOT_FOUND', 'This session is no longer available.', 404);
    return NextResponse.json({ ...participant, session_status: session.status, viewer_count: session.viewer_count }, {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    console.error('Session admission status failed:', error);
    return apiError('INTERNAL_SERVER_ERROR', 'Unable to check session access. Please retry.', 500);
  }
}

// POST /api/sessions/[id]/join
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { user, error: authErr } = await getUserFromRequest(request);
    if (authErr || !user) {
      return NextResponse.json({ detail: authErr || 'Not authenticated' }, { status: 401 });
    }

    const { id: sessionId } = await context.params;

    const db = getSupabaseAdmin(request);
    const { data: participant, error: joinError } = await db.rpc('join_session', {
      p_session_id: sessionId,
      p_user_id: user.id,
    });

    if (joinError) {
      const message = joinError.message || 'Unable to join session';
      const status = /not found/i.test(message) ? 404 : /ended|capacity/i.test(message) ? 409 : 400;
      return NextResponse.json({ detail: message }, { status });
    }

    return NextResponse.json(participant);
  } catch (error: any) {
    console.error('Join session error:', error);
    return NextResponse.json(
      { error: 'Failed to join session', detail: error?.message },
      { status: 500 }
    );
  }
}
