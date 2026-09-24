import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin, getUserFromRequest } from '@/lib/supabase';

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { user, role, error: authError } = await getUserFromRequest(request);
    if (authError || !user) return NextResponse.json({ detail: authError || 'Not authenticated' }, { status: 401 });
    const { id: sessionId } = await context.params;
    const db = getSupabaseAdmin(request);
    const { data: session, error: sessionError } = await db
      .from('live_sessions')
      .select('host_id, status')
      .eq('id', sessionId)
      .single();
    if (sessionError || !session) return NextResponse.json({ detail: 'Session not found' }, { status: 404 });
    if (session.host_id !== user.id && role !== 'admin') return NextResponse.json({ detail: 'Only the host or an administrator can end this session' }, { status: 403 });
    if (session.status === 'ended') return NextResponse.json({ success: true, status: 'ended' });

    const { error } = await db
      .from('live_sessions')
      .update({ status: 'ended', ended_at: new Date().toISOString(), viewer_count: 0 })
      .eq('id', sessionId);
    if (error) throw error;

    return NextResponse.json({ success: true, status: 'ended' });
  } catch (error: any) {
    return NextResponse.json({ detail: error?.message || 'Unable to end session' }, { status: 500 });
  }
}
