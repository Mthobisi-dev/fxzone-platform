import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';



// DELETE /api/sessions/history — clear all ended sessions
export async function DELETE(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });

    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) return NextResponse.json({ detail: 'Invalid session' }, { status: 401 });

    await supabaseAdmin.from('live_sessions').delete().eq('status', 'ended');
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: 'Failed to clear history', detail: error?.message }, { status: 500 });
  }
}
