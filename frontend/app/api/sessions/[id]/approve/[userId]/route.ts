import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin, getUserFromRequest } from '@/lib/supabase';

export async function POST(request: NextRequest, context: { params: Promise<{ id: string; userId: string }> }) {
  try {
    const { user, error: authError } = await getUserFromRequest(request);
    if (authError || !user) return NextResponse.json({ detail: authError || 'Not authenticated' }, { status: 401 });
    const { id: sessionId, userId } = await context.params;
    const { data, error } = await getSupabaseAdmin(request).rpc('review_session_participant', {
      p_session_id: sessionId, p_host_id: user.id, p_user_id: userId, p_decision: 'approve',
    });
    if (error) return NextResponse.json({ detail: error.message }, { status: /full capacity/i.test(error.message) ? 409 : 400 });
    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ detail: error?.message || 'Unable to approve participant' }, { status: 500 });
  }
}
