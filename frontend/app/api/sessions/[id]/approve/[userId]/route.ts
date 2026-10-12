import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin, getUserFromRequest } from '@/lib/supabase';
import { apiError } from '@/lib/api-error';

export async function POST(request: NextRequest, context: { params: Promise<{ id: string; userId: string }> }) {
  try {
    const { user, error: authError } = await getUserFromRequest(request);
    if (authError || !user) return apiError('UNAUTHORIZED', 'Authentication required', 401);
    const { id: sessionId, userId } = await context.params;
    const { data, error } = await getSupabaseAdmin(request).rpc('review_session_participant', {
      p_session_id: sessionId, p_host_id: user.id, p_user_id: userId, p_decision: 'approve',
    });
    if (error) {
      if (/only the host/i.test(error.message)) return apiError('FORBIDDEN', 'Only the host can approve access requests.', 403);
      if (/no longer follows/i.test(error.message)) return apiError('CONFLICT', 'This trader no longer follows the host and cannot be approved.', 409);
      if (/full capacity/i.test(error.message)) return apiError('CONFLICT', 'This live session is at full capacity.', 409);
      return apiError('BAD_REQUEST', 'This access request can no longer be approved.', 400);
    }
    return NextResponse.json(data);
  } catch (error: unknown) {
    console.error('Approve session participant error:', error);
    return apiError('INTERNAL_SERVER_ERROR', 'Unable to approve this access request. Please try again.', 500);
  }
}
