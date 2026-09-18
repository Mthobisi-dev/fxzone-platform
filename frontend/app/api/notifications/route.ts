import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';



async function getUser(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const token = authHeader?.replace('Bearer ', '');
  if (!token) return null;
  const { data: { user } } = await supabaseAdmin.auth.getUser(token);
  return user;
}

// GET /api/notifications — fetch notifications for authenticated user
export async function GET(request: NextRequest) {
  try {
    const user = await getUser(request);
    if (!user) {
      return NextResponse.json([], { status: 200 });
    }

    const { data, error } = await supabaseAdmin
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
    const user = await getUser(request);
    if (!user) return NextResponse.json({ success: true });

    const body = await request.json().catch(() => ({}));
    const { ids } = body;

    let query = supabaseAdmin
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
