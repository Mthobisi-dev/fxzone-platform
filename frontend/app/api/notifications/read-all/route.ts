import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin, getUserFromRequest } from '@/lib/server/supabaseServer';

export async function PUT(request: NextRequest) {
  try {
    const { user, error: authError } = await getUserFromRequest(request);
    if (authError || !user) {
      return NextResponse.json({ success: true });
    }

    const client = getSupabaseAdmin(request);

    await client
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', user.id);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Notification mark-all read error:', error);
    return NextResponse.json({ success: true });
  }
}
