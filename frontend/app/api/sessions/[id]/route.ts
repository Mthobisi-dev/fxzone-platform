import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin, getUserFromRequest } from '@/lib/supabase';

// GET /api/sessions/[id]
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;

    const { data, error } = await supabaseAdmin
      .from('live_sessions')
      .select(`
        id, title, description, status, session_type,
        viewer_count, max_participants, requires_approval, host_id,
        started_at, ended_at, created_at,
        users:host_id (id, username, display_name, avatar_url)
      `)
      .eq('id', id)
      .single();

    if (error || !data) {
      return NextResponse.json({ detail: 'Session not found' }, { status: 404 });
    }

    return NextResponse.json({
      id: data.id,
      host_id: data.host_id,
      hostId: data.host_id,
      host: {
        id: (data as any).users?.id,
        username: (data as any).users?.username,
        display_name: (data as any).users?.display_name,
        displayName: (data as any).users?.display_name,
        avatar_url: (data as any).users?.avatar_url,
        avatarUrl: (data as any).users?.avatar_url,
      },
      title: data.title,
      description: data.description,
      status: data.status,
      session_type: data.session_type,
      viewer_count: data.viewer_count,
      requires_approval: (data as any).requires_approval ?? false,
      started_at: data.started_at,
      ended_at: data.ended_at,
      created_at: data.created_at,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Failed to fetch session', detail: error?.message },
      { status: 500 }
    );
  }
}

// DELETE /api/sessions/[id]
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { user, role, error: authErr } = await getUserFromRequest(request);
    if (authErr || !user) return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });

    const { id } = await context.params;

    const { data: session } = await supabaseAdmin
      .from('live_sessions')
      .select('host_id')
      .eq('id', id)
      .single();

    if (!session || (session.host_id !== user.id && role !== 'admin')) {
      return NextResponse.json({ detail: 'Unauthorized' }, { status: 403 });
    }

    await supabaseAdmin.from('live_sessions').delete().eq('id', id);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Failed to delete session', detail: error?.message },
      { status: 500 }
    );
  }
}
