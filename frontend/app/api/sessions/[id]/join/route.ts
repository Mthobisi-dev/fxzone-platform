import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';



async function getUser(request: NextRequest) {
  const token = request.headers.get('authorization')?.replace('Bearer ', '');
  if (!token) return null;
  try {
    const { data: { user } } = await supabaseAdmin.auth.getUser(token);
    return user;
  } catch { return null; }
}

// POST /api/sessions/[id]/join
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUser(request);
    if (!user) return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });

    const { id: sessionId } = await context.params;

    const { data: session } = await supabaseAdmin
      .from('live_sessions')
      .select('id, host_id, requires_approval, status, viewer_count')
      .eq('id', sessionId)
      .single();

    if (!session) {
      return NextResponse.json({ detail: 'Session not found' }, { status: 404 });
    }

    const isHost = session.host_id === user.id;

    // Check if already a participant
    const { data: existing } = await supabaseAdmin
      .from('session_participants')
      .select('id, role')
      .eq('session_id', sessionId)
      .eq('user_id', user.id)
      .single();

    if (existing) {
      return NextResponse.json({ id: existing.id, role: existing.role });
    }

    const role = isHost ? 'host' : session.requires_approval ? 'pending' : 'viewer';

    const { data: participant, error: insertError } = await supabaseAdmin
      .from('session_participants')
      .insert({
        session_id: sessionId,
        user_id: user.id,
        role,
        joined_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (insertError) throw insertError;

    // Increment viewer count if not pending
    if (role !== 'pending') {
      try {
        await supabaseAdmin
          .from('live_sessions')
          .update({ viewer_count: (session.viewer_count || 0) + 1 })
          .eq('id', sessionId);
      } catch {
        // Ignore error updating viewer count
      }
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
