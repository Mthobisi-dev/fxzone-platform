import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin, getUserFromRequest } from '@/lib/supabase';
import { apiError } from '@/lib/api-error';
import { getPostMediaExtension, getPostMediaSizeLimit, POST_MEDIA_BUCKET, resolvePostMediaType } from '@/lib/postUpload';

// POST /api/social/posts/upload — uploads one authenticated social-post attachment.
export async function POST(request: NextRequest) {
  try {
    const { user, error: authErr } = await getUserFromRequest(request);
    if (authErr || !user) return apiError('UNAUTHORIZED', 'Authentication required.', 401);

    const formData = await request.formData();
    const file = formData.get('file');
    if (!file || typeof file === 'string') return apiError('BAD_REQUEST', 'Choose an attachment before publishing.', 400);
    if (file.size === 0) return apiError('BAD_REQUEST', 'The selected attachment is empty.', 400);

    const fileBody = Buffer.from(await file.arrayBuffer());
    const verifiedType = resolvePostMediaType(file.type, fileBody);
    if (!verifiedType) return NextResponse.json({ error: { code: 'UNSUPPORTED_MEDIA_TYPE', message: 'This attachment is unsupported or its content could not be verified.' } }, { status: 415 });
    const extension = getPostMediaExtension(verifiedType);
    if (!extension) return NextResponse.json({ error: { code: 'UNSUPPORTED_MEDIA_TYPE', message: 'This attachment type is not supported.' } }, { status: 415 });
    if (file.size > getPostMediaSizeLimit(verifiedType)) return NextResponse.json({ error: { code: 'PAYLOAD_TOO_LARGE', message: 'The attachment exceeds the size limit for its media type.' } }, { status: 413 });

    const db = getSupabaseAdmin(request);
    const filePath = `${user.id}/${crypto.randomUUID()}.${extension}`;
    const { error: uploadError } = await db.storage.from(POST_MEDIA_BUCKET).upload(filePath, fileBody, {
      contentType: verifiedType, cacheControl: '31536000', upsert: false,
    });
    if (uploadError) {
      console.error('Post attachment upload failed:', uploadError);
      return apiError('SERVICE_UNAVAILABLE', 'The attachment could not be stored. Please retry in a moment.', 503);
    }

    const { data: publicUrlData } = db.storage.from(POST_MEDIA_BUCKET).getPublicUrl(filePath);
    if (!publicUrlData.publicUrl) {
      return apiError('SERVICE_UNAVAILABLE', 'The attachment was stored but its URL could not be created. Please retry.', 503);
    }
    return NextResponse.json({ url: publicUrlData.publicUrl, path: filePath }, { status: 201 });
  } catch (error: unknown) {
    console.error('Post attachment upload error:', error);
    return apiError('SERVICE_UNAVAILABLE', 'The attachment service is unavailable. Please try again shortly.', 503);
  }
}
