import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin, getUserFromRequest } from '@/lib/supabase';

// DELETE /api/sessions/history — clear all ended sessions
export async function DELETE(request: NextRequest) {
  try {
    const { user, role, error: authErr } = await getUserFromRequest(request);
    if (authErr || !user) {
      return NextResponse.json({ detail: authErr || 'Not authenticated' }, { status: 401 });
    }

    if (role !== 'admin') {
      return NextResponse.json({ detail: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const { error: deleteError } = await supabaseAdmin
      .from('live_sessions')
      .delete()
      .eq('status', 'ended');

    if (deleteError) throw deleteError;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: 'Failed to clear history', detail: error?.message }, { status: 500 });
  }
}
