import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin, getUserFromRequest } from '@/lib/supabase';
import { apiError } from '@/lib/api-error';

const BUCKET = 'post-media';
const MB = 1024 * 1024;
const ALLOWED_TYPES: Record<string, string> = {
  'image/jpeg': 'jpg', 'image/png': 'png', 'image/gif': 'gif', 'image/webp': 'webp',
  'video/mp4': 'mp4', 'video/quicktime': 'mov', 'video/webm': 'webm', 'video/x-matroska': 'mkv',
  'audio/webm': 'webm', 'audio/mp3': 'mp3', 'audio/mpeg': 'mp3', 'audio/wav': 'wav', 'audio/ogg': 'ogg',
  'application/pdf': 'pdf',
};

function sizeLimitFor(type: string): number {
  if (type.startsWith('image/')) return 10 * MB;
  if (type === 'application/pdf') return 20 * MB;
  if (type.startsWith('audio/')) return 25 * MB;
  return 100 * MB;
}

function startsWith(bytes: Buffer, signature: number[], offset = 0) {
  return signature.every((byte, index) => bytes[offset + index] === byte);
}

/** Validate file bytes as well as the browser-provided MIME type. */
function matchesMediaSignature(type: string, bytes: Buffer): boolean {
  if (type === 'image/jpeg') return startsWith(bytes, [0xff, 0xd8, 0xff]);
  if (type === 'image/png') return startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (type === 'image/gif') return startsWith(bytes, [0x47, 0x49, 0x46, 0x38]);
  if (type === 'image/webp') return startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) && bytes.subarray(8, 12).toString('ascii') === 'WEBP';
  if (type === 'application/pdf') return startsWith(bytes, [0x25, 0x50, 0x44, 0x46, 0x2d]);
  if (type === 'video/mp4' || type === 'video/quicktime') return bytes.subarray(4, 8).toString('ascii') === 'ftyp';
  if (type === 'video/webm' || type === 'video/x-matroska' || type === 'audio/webm') return startsWith(bytes, [0x1a, 0x45, 0xdf, 0xa3]);
  if (type === 'audio/wav') return startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) && bytes.subarray(8, 12).toString('ascii') === 'WAVE';
  if (type === 'audio/ogg') return startsWith(bytes, [0x4f, 0x67, 0x67, 0x53]);
  if (type === 'audio/mpeg' || type === 'audio/mp3') return startsWith(bytes, [0x49, 0x44, 0x33]) || (bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0);
  return false;
}

// POST /api/social/posts/upload — uploads one authenticated social-post attachment.
export async function POST(request: NextRequest) {
  try {
    const { user, error: authErr } = await getUserFromRequest(request);
    if (authErr || !user) return apiError('UNAUTHORIZED', authErr || 'Authentication required', 401);

    const formData = await request.formData();
    const file = formData.get('file');
    if (!file || typeof file === 'string') return apiError('BAD_REQUEST', 'Choose an attachment before publishing.', 400);
    if (file.size === 0) return apiError('BAD_REQUEST', 'The selected attachment is empty.', 400);

    const extension = ALLOWED_TYPES[file.type];
    if (!extension) return NextResponse.json({ error: { code: 'UNSUPPORTED_MEDIA_TYPE', message: 'This attachment type is not supported.' } }, { status: 415 });
    if (file.size > sizeLimitFor(file.type)) return NextResponse.json({ error: { code: 'PAYLOAD_TOO_LARGE', message: 'The attachment exceeds the size limit for its media type.' } }, { status: 413 });

    const fileBody = Buffer.from(await file.arrayBuffer());
    if (!matchesMediaSignature(file.type, fileBody)) {
      return NextResponse.json({ error: { code: 'INVALID_MEDIA_CONTENT', message: 'The attachment content does not match its declared media type.' } }, { status: 415 });
    }

    const db = getSupabaseAdmin(request);
    const filePath = `${user.id}/${crypto.randomUUID()}.${extension}`;
    const { error: uploadError } = await db.storage.from(BUCKET).upload(filePath, fileBody, {
      contentType: file.type, cacheControl: '31536000', upsert: false,
    });
    if (uploadError) {
      console.error('Post attachment upload failed:', uploadError);
      return apiError('SERVICE_UNAVAILABLE', 'The attachment could not be stored. Please retry in a moment.', 503);
    }

    const { data: publicUrlData } = db.storage.from(BUCKET).getPublicUrl(filePath);
    if (!publicUrlData.publicUrl) {
      return apiError('SERVICE_UNAVAILABLE', 'The attachment was stored but its URL could not be created. Please retry.', 503);
    }
    return NextResponse.json({ url: publicUrlData.publicUrl, path: filePath }, { status: 201 });
  } catch (error: unknown) {
    console.error('Post attachment upload error:', error);
    return apiError('SERVICE_UNAVAILABLE', 'The attachment service is unavailable. Please try again shortly.', 503);
  }
}
