import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';



// POST /api/sessions/[id]/leave
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ success: true });

    const { data: { user } } = await supabaseAdmin.auth.getUser(token);
    if (!user) return NextResponse.json({ success: true });

    const { id: sessionId } = await context.params;

    await supabaseAdmin
      .from('session_participants')
      .update({ left_at: new Date().toISOString() })
      .eq('session_id', sessionId)
      .eq('user_id', user.id);

    const { data: session } = await supabaseAdmin
      .from('live_sessions')
      .select('viewer_count, host_id')
      .eq('id', sessionId)
      .single();

    if (session && user.id === session.host_id) {
      await supabaseAdmin
        .from('live_sessions')
        .update({ status: 'ended', ended_at: new Date().toISOString() })
        .eq('id', sessionId);
    } else if (session && session.viewer_count > 0) {
      await supabaseAdmin
        .from('live_sessions')
        .update({ viewer_count: session.viewer_count - 1 })
        .eq('id', sessionId);
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Leave session error:', error);
    return NextResponse.json({ success: true });
  }
}
