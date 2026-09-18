import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin, getUserFromRequest } from '@/lib/supabase';

// POST /api/sessions/[id]/leave
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { user } = await getUserFromRequest(request);
    if (!user) return NextResponse.json({ success: true });

    const { id: sessionId } = await context.params;

    await supabaseAdmin
      .from('session_participants')
      .update({ left_at: new Date().toISOString() })
      .eq('session_id', sessionId)
      .eq('user_id', user.id);

    const { data: session } = await supabaseAdmin
      .from('live_sessions')
      .select('host_id')
      .eq('id', sessionId)
      .maybeSingle();

    if (session && user.id === session.host_id) {
      await supabaseAdmin
        .from('live_sessions')
        .update({ status: 'ended', ended_at: new Date().toISOString(), viewer_count: 0 })
        .eq('id', sessionId);
    } else {
      // Recalculate remaining active viewers
      const { count: remainingViewers } = await supabaseAdmin
        .from('session_participants')
        .select('*', { count: 'exact', head: true })
        .eq('session_id', sessionId)
        .is('left_at', null)
        .neq('role', 'pending');

      await supabaseAdmin
        .from('live_sessions')
        .update({ viewer_count: Math.max(0, remainingViewers || 0) })
        .eq('id', sessionId);
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Leave session error:', error);
    return NextResponse.json({ success: true });
  }
}
