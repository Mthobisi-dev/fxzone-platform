/** Shared constraints for authenticated social-post media uploads. */
export const POST_MEDIA_BUCKET = 'post-media';
export const MB = 1024 * 1024;

/**
 * Vercel Functions accept request bodies up to 4.5 MB. Keep multipart uploads
 * below 4 MB on the server route to leave room for multipart framing; larger
 * files use a short-lived, server-issued Supabase Storage upload URL.
 */
export const DIRECT_POST_UPLOAD_THRESHOLD_BYTES = 4 * MB;

const POST_MEDIA_EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'video/mp4': 'mp4',
  'video/quicktime': 'mov',
  'video/webm': 'webm',
  'video/x-matroska': 'mkv',
  'audio/webm': 'webm',
  'audio/mp3': 'mp3',
  'audio/mpeg': 'mp3',
  'audio/wav': 'wav',
  'audio/ogg': 'ogg',
  'application/pdf': 'pdf',
};

export function getPostMediaExtension(mimeType: string): string | null {
  return POST_MEDIA_EXTENSIONS[mimeType] ?? null;
}

export function getPostMediaSizeLimit(mimeType: string): number {
  if (!getPostMediaExtension(mimeType)) return 0;
  if (mimeType.startsWith('image/')) return 10 * MB;
  if (mimeType === 'application/pdf') return 20 * MB;
  if (mimeType.startsWith('audio/')) return 25 * MB;
  return 100 * MB;
}

export function isAllowedPostMedia(mimeType: string, size: number): boolean {
  const limit = getPostMediaSizeLimit(mimeType);
  return Number.isSafeInteger(size) && size > 0 && limit > 0 && size <= limit;
}

export function shouldUseDirectPostUpload(size: number): boolean {
  return Number.isSafeInteger(size) && size > DIRECT_POST_UPLOAD_THRESHOLD_BYTES;
}
