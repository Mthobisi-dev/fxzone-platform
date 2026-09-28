import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin, getUserFromRequest } from '@/lib/server/supabaseServer';
import { apiError } from '@/lib/api-error';

// GET /api/notifications — fetch notifications for authenticated user
export async function GET(request: NextRequest) {
  try {
    const { user } = await getUserFromRequest(request);
    if (!user) {
      return apiError('UNAUTHORIZED', 'Authentication required', 401);
    }

    const client = getSupabaseAdmin(request);
    const { data, error } = await client
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) throw error;

    // Allow client-side caching for 10s to reduce repeated polling impact
    return NextResponse.json(data || [], {
      headers: {
        'Cache-Control': 'private, max-age=10, stale-while-revalidate=20',
      },
    });
  } catch (error: unknown) {
    console.error('Notifications fetch error:', error);
    return apiError('INTERNAL_SERVER_ERROR', 'Unable to load notifications.', 500);
  }
}

// PUT /api/notifications — mark notifications as read
export async function PUT(request: NextRequest) {
  try {
    const { user, error: authError } = await getUserFromRequest(request);
    if (authError || !user) {
      return apiError('UNAUTHORIZED', authError || 'Authentication required', 401);
    }

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

    const { error } = await query;
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error('Notifications update error:', error);
    return apiError('INTERNAL_SERVER_ERROR', 'Unable to update notifications.', 500);
  }
}
