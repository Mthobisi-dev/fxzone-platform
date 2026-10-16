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
  'image/avif': 'avif',
  'video/mp4': 'mp4',
  'video/quicktime': 'mov',
  'video/webm': 'webm',
  'video/x-matroska': 'mkv',
  'audio/webm': 'webm',
  'audio/mp3': 'mp3',
  'audio/mpeg': 'mp3',
  'audio/wav': 'wav',
  'audio/ogg': 'ogg',
  'audio/mp4': 'm4a',
  'application/pdf': 'pdf',
};

function hasBytes(bytes: Uint8Array, signature: readonly number[], offset = 0): boolean {
  return offset >= 0
    && offset + signature.length <= bytes.length
    && signature.every((byte, index) => bytes[offset + index] === byte);
}

function ascii(bytes: Uint8Array, start: number, end: number): string {
  let value = '';
  for (let index = start; index < Math.min(end, bytes.length); index += 1) {
    value += String.fromCharCode(bytes[index]);
  }
  return value;
}

function readUint32(bytes: Uint8Array, offset: number): number {
  if (offset + 4 > bytes.length) return 0;
  return (((bytes[offset] << 24) >>> 0)
    + (bytes[offset + 1] << 16)
    + (bytes[offset + 2] << 8)
    + bytes[offset + 3]) >>> 0;
}

function detectIsoBaseMediaType(bytes: Uint8Array): string | null {
  const scanLimit = Math.min(bytes.length, 4096);
  let offset = 0;
  while (offset + 8 <= scanLimit) {
    const size = readUint32(bytes, offset);
    const boxType = ascii(bytes, offset + 4, offset + 8);
    if (boxType === 'ftyp') {
      const boxEnd = size >= 8 ? Math.min(offset + size, scanLimit) : scanLimit;
      const brands = ascii(bytes, offset + 8, boxEnd).toLowerCase();
      if (brands.includes('avif') || brands.includes('avis')) return 'image/avif';
      if (brands.includes('qt  ')) return 'video/quicktime';
      if (brands.includes('m4a ')) return 'audio/mp4';
      return 'video/mp4';
    }
    if (size < 8 || offset + size > scanLimit) break;
    offset += size;
  }
  return null;
}

/** Detects a supported media type from file bytes instead of trusting browser metadata. */
export function detectPostMediaType(bytes: Uint8Array): string | null {
  if (hasBytes(bytes, [0xff, 0xd8, 0xff])) return 'image/jpeg';
  if (hasBytes(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'image/png';
  if (hasBytes(bytes, [0x47, 0x49, 0x46, 0x38])) return 'image/gif';
  if (hasBytes(bytes, [0x52, 0x49, 0x46, 0x46]) && ascii(bytes, 8, 12) === 'WEBP') return 'image/webp';
  if (hasBytes(bytes, [0x52, 0x49, 0x46, 0x46]) && ascii(bytes, 8, 12) === 'WAVE') return 'audio/wav';
  if (hasBytes(bytes, [0x4f, 0x67, 0x67, 0x53])) return 'audio/ogg';
  if (hasBytes(bytes, [0x49, 0x44, 0x33]) || (bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0)) return 'audio/mpeg';
  if (hasBytes(bytes, [0x1a, 0x45, 0xdf, 0xa3])) return 'video/webm';

  const header = ascii(bytes, 0, Math.min(bytes.length, 1024));
  if (header.includes('%PDF-')) return 'application/pdf';
  return detectIsoBaseMediaType(bytes);
}

/**
 * Returns the byte-derived type, retaining a supported declared type only for
 * EBML containers whose initial bytes cannot distinguish WebM audio/video/MKV.
 */
export function resolvePostMediaType(declaredType: string, bytes: Uint8Array): string | null {
  const detected = detectPostMediaType(bytes);
  if (!detected) return null;
  if (detected === 'video/webm' && ['video/webm', 'video/x-matroska', 'audio/webm'].includes(declaredType)) {
    return declaredType;
  }
  return getPostMediaExtension(detected) ? detected : null;
}

/** Normalizes browser-selected files before either multipart or signed upload. */
export async function normalizePostMediaFile(file: File): Promise<File> {
  const header = new Uint8Array(await file.slice(0, 4096).arrayBuffer());
  const detectedType = resolvePostMediaType(file.type, header);
  if (!detectedType) throw new Error('This attachment is unsupported or its content cannot be verified.');
  if (detectedType === file.type) return file;
  return new File([file], file.name, { type: detectedType, lastModified: file.lastModified });
}

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
