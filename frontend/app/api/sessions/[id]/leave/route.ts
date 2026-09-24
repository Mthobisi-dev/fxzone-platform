import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin, getUserFromRequest } from '@/lib/supabase';

// POST /api/sessions/[id]/leave
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { user, error: authError } = await getUserFromRequest(request);
    if (authError || !user) {
      return NextResponse.json({ detail: authError || 'Not authenticated' }, { status: 401 });
    }

    const { id: sessionId } = await context.params;

    const db = getSupabaseAdmin(request);
    const { error: leaveError } = await db.rpc('leave_session', {
      p_session_id: sessionId,
      p_user_id: user.id,
    });

    if (leaveError) {
      const status = /not found/i.test(leaveError.message) ? 404 : 400;
      return NextResponse.json({ detail: leaveError.message }, { status });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Leave session error:', error);
    return NextResponse.json({ detail: error?.message || 'Failed to leave session' }, { status: 500 });
  }
}
