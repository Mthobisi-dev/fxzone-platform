import { NextRequest, NextResponse } from 'next/server';
import { apiError } from '@/lib/api-error';
import { getSupabaseAdmin, getUserFromRequest } from '@/lib/supabase';
import { getPostMediaExtension, isAllowedPostMedia, POST_MEDIA_BUCKET } from '@/lib/postUpload';

/**
 * Creates a single-use Storage upload token for a large social-post attachment.
 *
 * Browser uploads use the returned token directly with Supabase Storage, so the
 * video body never passes through a Vercel Function. The service role remains
 * server-only and the object path is generated under the authenticated user's
 * own folder; callers cannot choose a bucket or object name.
 */
export async function POST(request: NextRequest) {
  try {
    const { user, error: authError } = await getUserFromRequest(request);
    if (authError || !user) return apiError('UNAUTHORIZED', authError || 'Authentication required', 401);

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return apiError('BAD_REQUEST', 'Upload details must be valid JSON.', 400);
    }

    if (!body || typeof body !== 'object') {
      return apiError('BAD_REQUEST', 'Upload details are required.', 400);
    }

    const { type, size } = body as { type?: unknown; size?: unknown };
    if (typeof type !== 'string' || !Number.isSafeInteger(size) || !isAllowedPostMedia(type, size)) {
      return apiError('UNPROCESSABLE_ENTITY', 'The selected attachment type or size is not allowed.', 422);
    }

    const extension = getPostMediaExtension(type);
    if (!extension) {
      return apiError('UNSUPPORTED_MEDIA_TYPE', 'This attachment type is not supported.', 415);
    }

    const db = getSupabaseAdmin(request);
    const path = `${user.id}/${crypto.randomUUID()}.${extension}`;
    const { data, error } = await db.storage.from(POST_MEDIA_BUCKET).createSignedUploadUrl(path, { upsert: false });
    if (error || !data?.token) {
      console.error('Unable to create a signed post upload URL:', error);
      return apiError('SERVICE_UNAVAILABLE', 'The attachment service is unavailable. Please try again shortly.', 503);
    }

    const { data: publicUrlData } = db.storage.from(POST_MEDIA_BUCKET).getPublicUrl(path);
    if (!publicUrlData.publicUrl) {
      return apiError('SERVICE_UNAVAILABLE', 'The attachment URL could not be created. Please try again.', 503);
    }

    return NextResponse.json(
      { path, token: data.token, url: publicUrlData.publicUrl },
      { status: 201, headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error: unknown) {
    console.error('Post upload URL error:', error);
    return apiError('SERVICE_UNAVAILABLE', 'The attachment service is unavailable. Please try again shortly.', 503);
  }
}
