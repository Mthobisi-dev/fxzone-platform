import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin, getUserFromRequest } from '@/lib/server/supabaseServer';

// GET /api/notifications — fetch notifications for authenticated user
export async function GET(request: NextRequest) {
  try {
    const { user } = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json([], { status: 200 });
    }

    const client = getSupabaseAdmin(request);
    const { data, error } = await client
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) throw error;
    return NextResponse.json(data || []);
  } catch (error: any) {
    console.error('Notifications fetch error:', error);
    return NextResponse.json([], { status: 200 });
  }
}

// PUT /api/notifications — mark notifications as read
export async function PUT(request: NextRequest) {
  try {
    const { user } = await getUserFromRequest(request);
    if (!user) return NextResponse.json({ success: true });

    const client = getSupabaseAdmin(request);
    const body = await request.json().catch(() => ({}));
    const { ids } = body;

    let query = client
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', user.id);

    if (ids && Array.isArray(ids) && ids.length > 0) {
      query = query.in('id', ids);
    }

    await query;
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Notifications update error:', error);
    return NextResponse.json({ success: true });
  }
}

