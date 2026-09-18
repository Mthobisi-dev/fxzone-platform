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

// GET /api/sessions — list all live sessions with host info
export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from('live_sessions')
      .select(`
        id, title, description, status, session_type,
        viewer_count, max_participants, requires_approval,
        started_at, ended_at, created_at, host_id,
        users:host_id (id, username, display_name, avatar_url)
      `)
      .neq('status', 'ended')
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) throw error;

    const sessions = (data || []).map((s: any) => ({
      id: s.id,
      host_id: s.host_id,
      hostId: s.host_id,
      host: {
        id: s.users?.id,
        username: s.users?.username,
        displayName: s.users?.display_name || s.users?.username,
        avatarUrl: s.users?.avatar_url || null,
      },
      title: s.title,
      description: s.description || '',
      status: s.status,
      session_type: s.session_type,
      participantsCount: s.viewer_count || 0,
      viewer_count: s.viewer_count || 0,
      requires_approval: s.requires_approval,
      requiresApproval: s.requires_approval,
      started_at: s.started_at,
      startedAt: s.started_at,
      created_at: s.created_at,
    }));

    return NextResponse.json(sessions);
  } catch (error: any) {
    console.error('Sessions list error:', error);
    return NextResponse.json([], { status: 200 });
  }
}

// POST /api/sessions — create a new live session
export async function POST(request: NextRequest) {
  try {
    const user = await getUser(request);
    if (!user) return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });

    const body = await request.json();
    const { title, description, requires_approval, session_type } = body;

    if (!title?.trim()) {
      return NextResponse.json({ detail: 'Title is required' }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from('live_sessions')
      .insert({
        host_id: user.id,
        title: title.trim(),
        description: (description || '').trim(),
        requires_approval: !!requires_approval,
        session_type: session_type || 'public',
        status: 'live',
        started_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) throw error;

    // Auto-add host as participant (ignore errors)
    try {
      await supabaseAdmin.from('session_participants').insert({
        session_id: data.id,
        user_id: user.id,
        role: 'host',
      });
    } catch (_) { /* ignore */ }

    return NextResponse.json({ id: data.id, ...data }, { status: 201 });
  } catch (error: any) {
    console.error('Create session error:', error);
    return NextResponse.json(
      { error: 'Failed to create session', detail: error?.message },
      { status: 500 }
    );
  }
}

// DELETE /api/sessions — bulk clear ended sessions
export async function DELETE(request: NextRequest) {
  try {
    const user = await getUser(request);
    if (!user) return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });

    await supabaseAdmin.from('live_sessions').delete().eq('status', 'ended');
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Failed to clear history', detail: error?.message },
      { status: 500 }
    );
  }
}
