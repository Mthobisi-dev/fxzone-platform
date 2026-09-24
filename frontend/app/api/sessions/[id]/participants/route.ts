import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin, getUserFromRequest } from '@/lib/supabase';

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { user, error: authError } = await getUserFromRequest(request);
    if (authError || !user) return NextResponse.json({ detail: authError || 'Not authenticated' }, { status: 401 });

    const { id: sessionId } = await context.params;
    const db = getSupabaseAdmin(request);
    const { data: session, error: sessionError } = await db
      .from('live_sessions')
      .select('host_id')
      .eq('id', sessionId)
      .single();

    if (sessionError || !session) return NextResponse.json({ detail: 'Session not found' }, { status: 404 });
    if (session.host_id !== user.id) return NextResponse.json({ detail: 'Only the host can view participant requests' }, { status: 403 });

    const { data, error } = await db
      .from('session_participants')
      .select('id, user_id, role, joined_at, left_at, users:user_id (id, username, display_name, avatar_url)')
      .eq('session_id', sessionId)
      .is('left_at', null)
      .order('joined_at', { ascending: true });
    if (error) throw error;

    return NextResponse.json((data || []).map((participant: any) => ({
      id: participant.id,
      user_id: participant.user_id,
      role: participant.role,
      joined_at: participant.joined_at,
      user: participant.users,
    })));
  } catch (error: any) {
    return NextResponse.json({ detail: error?.message || 'Unable to load participants' }, { status: 500 });
  }
}
