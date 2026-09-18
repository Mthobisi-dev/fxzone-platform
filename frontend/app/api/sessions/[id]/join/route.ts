import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin, getUserFromRequest } from '@/lib/supabase';

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

    // Check if session exists and is live
    const { data: session, error: sessionErr } = await supabaseAdmin
      .from('live_sessions')
      .select('id, host_id, status, max_participants, viewer_count')
      .eq('id', sessionId)
      .maybeSingle();

    if (sessionErr || !session) {
      return NextResponse.json({ detail: 'Session not found' }, { status: 404 });
    }

    if (session.status === 'ended') {
      return NextResponse.json({ detail: 'Session has already ended' }, { status: 400 });
    }

    const isHost = session.host_id === user.id;

    // Check capacity if max_participants is specified
    if (!isHost && typeof session.max_participants === 'number' && session.max_participants > 0) {
      const { count: activeCount } = await supabaseAdmin
        .from('session_participants')
        .select('*', { count: 'exact', head: true })
        .eq('session_id', sessionId)
        .is('left_at', null)
        .neq('role', 'pending');

      if (activeCount && activeCount >= session.max_participants) {
        return NextResponse.json({ detail: 'Session has reached maximum participant capacity' }, { status: 400 });
      }
    }

    // Check if user is already a participant
    const { data: existing } = await supabaseAdmin
      .from('session_participants')
      .select('id, role, left_at')
      .eq('session_id', sessionId)
      .eq('user_id', user.id)
      .maybeSingle();

    const role = isHost ? 'host' : 'viewer';

    let participant = existing;

    if (existing) {
      // Re-joining session if previously left or updating status
      const { data: updated, error: updateErr } = await supabaseAdmin
        .from('session_participants')
        .update({ role, left_at: null, joined_at: new Date().toISOString() })
        .eq('id', existing.id)
        .select()
        .single();

      if (!updateErr && updated) participant = updated;
    } else {
      // Insert new participant
      const { data: inserted, error: insertError } = await supabaseAdmin
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
      participant = inserted;
    }

    // Update real-time active viewer count on live_sessions
    const { count: currentViewerCount } = await supabaseAdmin
      .from('session_participants')
      .select('*', { count: 'exact', head: true })
      .eq('session_id', sessionId)
      .is('left_at', null)
      .neq('role', 'pending');

    await supabaseAdmin
      .from('live_sessions')
      .update({ viewer_count: Math.max(1, currentViewerCount || 1) })
      .eq('id', sessionId);

    return NextResponse.json(participant);
  } catch (error: any) {
    console.error('Join session error:', error);
    return NextResponse.json(
      { error: 'Failed to join session', detail: error?.message },
      { status: 500 }
    );
  }
}
