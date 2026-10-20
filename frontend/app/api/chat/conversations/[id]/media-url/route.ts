import { NextRequest, NextResponse } from 'next/server';
import { apiError } from '@/lib/api-error';
import { getSupabaseAdmin, getUserFromRequest } from '@/lib/server/supabaseServer';
import { CHAT_MEDIA_BUCKET } from '@/lib/chatMedia';

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { user, error: authError } = await getUserFromRequest(request);
    if (authError || !user) return apiError('UNAUTHORIZED', authError || 'Authentication required', 401);
    const { id: conversationId } = await context.params;
    const path = new URL(request.url).searchParams.get('path') || '';
    if (!path.startsWith(`${conversationId}/${user.id}/`) && !path.startsWith(`${conversationId}/`)) {
      return apiError('FORBIDDEN', 'You cannot access this attachment.', 403);
    }
    const db = getSupabaseAdmin(request);
    const { data: membership, error: membershipError } = await db.from('conversation_members')
      .select('id').eq('conversation_id', conversationId).eq('user_id', user.id).maybeSingle();
    if (membershipError) throw membershipError;
    if (!membership) return apiError('FORBIDDEN', 'You are not a member of this conversation.', 403);
    const { data, error } = await db.storage.from(CHAT_MEDIA_BUCKET).createSignedUrl(path, 60 * 60);
    if (error || !data?.signedUrl) return apiError('NOT_FOUND', 'Attachment not found.', 404);
    return NextResponse.json({ url: data.signedUrl, expires_in: 3600 }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('Chat media URL error:', error);
    return apiError('SERVICE_UNAVAILABLE', 'Attachment service is temporarily unavailable.', 503);
  }
}
