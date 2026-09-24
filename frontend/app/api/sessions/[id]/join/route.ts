import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin, getUserFromRequest } from '@/lib/supabase';

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
