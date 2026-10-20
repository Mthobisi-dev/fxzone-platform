import { NextRequest, NextResponse } from 'next/server';
import { apiError } from '@/lib/api-error';
import { getSupabaseAdmin, getUserFromRequest } from '@/lib/server/supabaseServer';
import { getPostMediaExtension, isAllowedPostMedia } from '@/lib/postUpload';
import { CHAT_MEDIA_BUCKET } from '@/lib/chatMedia';

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { user, error: authError } = await getUserFromRequest(request);
    if (authError || !user) return apiError('UNAUTHORIZED', authError || 'Authentication required', 401);
    const { id: conversationId } = await context.params;
    const body = await request.json().catch(() => null) as { type?: unknown; size?: unknown } | null;
    if (!body || typeof body.type !== 'string' || typeof body.size !== 'number' || !Number.isSafeInteger(body.size)) {
      return apiError('UNPROCESSABLE_ENTITY', 'A valid media type and size are required.', 422);
    }
    if (!isAllowedPostMedia(body.type, body.size)) {
      return apiError('PAYLOAD_TOO_LARGE', 'This attachment type or size is not allowed.', 413);
    }
    const extension = getPostMediaExtension(body.type);
    if (!extension) return apiError('UNSUPPORTED_MEDIA_TYPE', 'This attachment type is not supported.', 415);

    const db = getSupabaseAdmin(request);
    const { data: membership, error: membershipError } = await db
      .from('conversation_members')
      .select('id')
      .eq('conversation_id', conversationId)
      .eq('user_id', user.id)
      .maybeSingle();
    if (membershipError) throw membershipError;
    if (!membership) return apiError('FORBIDDEN', 'You are not a member of this conversation.', 403);

    const path = `${conversationId}/${user.id}/${crypto.randomUUID()}.${extension}`;
    const { data, error } = await db.storage.from(CHAT_MEDIA_BUCKET).createSignedUploadUrl(path, { upsert: false });
    if (error || !data?.token) {
      console.error('Unable to create signed chat upload URL:', error);
      return apiError('SERVICE_UNAVAILABLE', 'Private chat media is unavailable. Apply the chat-media migration and try again.', 503);
    }
    return NextResponse.json({ path, token: data.token }, { status: 201, headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('Chat media upload URL error:', error);
    return apiError('SERVICE_UNAVAILABLE', 'Private chat media is temporarily unavailable.', 503);
  }
}
