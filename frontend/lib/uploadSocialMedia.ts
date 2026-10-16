import { api } from '@/lib/api';
import { supabase } from '@/lib/supabase';
import { isAllowedPostMedia, normalizePostMediaFile, POST_MEDIA_BUCKET, shouldUseDirectPostUpload } from '@/lib/postUpload';

export async function uploadSocialMedia(file: File): Promise<string> {
  const verifiedFile = await normalizePostMediaFile(file);
  if (!isAllowedPostMedia(verifiedFile.type, verifiedFile.size)) throw new Error('Unsupported file type or file exceeds the upload size limit.');
  if (shouldUseDirectPostUpload(verifiedFile.size)) {
    const signed = await api.post('/api/social/posts/upload-url', { type: verifiedFile.type, size: verifiedFile.size }, { timeoutMs: 15_000 });
    if (!signed || typeof signed.path !== 'string' || typeof signed.token !== 'string' || typeof signed.url !== 'string') throw new Error('Unable to authorize the upload.');
    const { error } = await supabase.storage.from(POST_MEDIA_BUCKET).uploadToSignedUrl(signed.path, signed.token, verifiedFile, { contentType: verifiedFile.type, upsert: false });
    if (error) throw new Error('Upload failed. Check your connection and retry.');
    return signed.url;
  }
  const data = new FormData(); data.append('file', verifiedFile);
  const result = await api.post('/api/social/posts/upload', data, { timeoutMs: 60_000 });
  if (typeof result?.url !== 'string') throw new Error('Upload did not return a media URL.');
  return result.url;
}
