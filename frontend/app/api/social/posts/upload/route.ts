import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin, getUserFromRequest } from '@/lib/supabase';

const BUCKET = 'post-media';
const MAX_FILE_SIZE = 100 * 1024 * 1024;
const ALLOWED_TYPES: Record<string, string> = {
  'image/jpeg': 'jpg', 'image/png': 'png', 'image/gif': 'gif', 'image/webp': 'webp',
  'video/mp4': 'mp4', 'video/quicktime': 'mov', 'video/webm': 'webm', 'video/x-matroska': 'mkv',
  'audio/webm': 'webm', 'audio/mp3': 'mp3', 'audio/mpeg': 'mp3', 'audio/wav': 'wav', 'audio/ogg': 'ogg',
  'application/pdf': 'pdf',
};
const bucketOptions = { public: true, fileSizeLimit: MAX_FILE_SIZE, allowedMimeTypes: Object.keys(ALLOWED_TYPES) };

function isMissingBucket(error: unknown) {
  const value = error as { statusCode?: number | string; message?: string; error?: string } | null;
  const message = `${value?.message || ''} ${value?.error || ''}`.toLowerCase();
  return value?.statusCode === 404 || value?.statusCode === '404' || message.includes('bucket not found');
}

async function ensurePostMediaBucket(db: ReturnType<typeof getSupabaseAdmin>) {
  const { error } = await db.storage.createBucket(BUCKET, bucketOptions);
  if (error && !/already exists|duplicate/i.test(error.message || '')) throw error;
  const { error: updateError } = await db.storage.updateBucket(BUCKET, bucketOptions);
  if (updateError) throw updateError;
}

// POST /api/social/posts/upload — uploads one authenticated social-post attachment.
export async function POST(request: NextRequest) {
  try {
    const { user, error: authErr } = await getUserFromRequest(request);
    if (authErr || !user) return NextResponse.json({ detail: authErr || 'Not authenticated' }, { status: 401 });

    const formData = await request.formData();
    const file = formData.get('file');
    if (!file || typeof file === 'string') return NextResponse.json({ detail: 'Choose an attachment before publishing.' }, { status: 400 });
    if (file.size === 0) return NextResponse.json({ detail: 'The selected attachment is empty.' }, { status: 400 });
    if (file.size > MAX_FILE_SIZE) return NextResponse.json({ detail: 'Attachments must be 100 MB or smaller.' }, { status: 413 });

    const extension = ALLOWED_TYPES[file.type];
    if (!extension) return NextResponse.json({ detail: 'This attachment type is not supported.' }, { status: 415 });

    const db = getSupabaseAdmin(request);
    const filePath = `${user.id}/${crypto.randomUUID()}.${extension}`;
    const fileBody = Buffer.from(await file.arrayBuffer());
    const upload = () => db.storage.from(BUCKET).upload(filePath, fileBody, {
      contentType: file.type, cacheControl: '31536000', upsert: false,
    });

    let { error: uploadError } = await upload();
    if (uploadError && isMissingBucket(uploadError)) {
      await ensurePostMediaBucket(db);
      ({ error: uploadError } = await upload());
    }
    if (uploadError) {
      console.error('Post attachment upload failed:', uploadError);
      return NextResponse.json({ detail: 'The attachment could not be stored. Please retry in a moment.', code: 'STORAGE_UPLOAD_FAILED' }, { status: 502 });
    }

    const { data: publicUrlData } = db.storage.from(BUCKET).getPublicUrl(filePath);
    if (!publicUrlData.publicUrl) {
      return NextResponse.json({ detail: 'The attachment was stored but its URL could not be created. Please retry.', code: 'STORAGE_URL_FAILED' }, { status: 502 });
    }
    return NextResponse.json({ url: publicUrlData.publicUrl, path: filePath }, { status: 201 });
  } catch (error: unknown) {
    console.error('Post attachment upload error:', error);
    const cause = error instanceof Error ? error.message : 'Unexpected upload failure';
    return NextResponse.json({ detail: 'The attachment service is unavailable. Please try again shortly.', code: 'STORAGE_UNAVAILABLE', cause }, { status: 503 });
  }
}
