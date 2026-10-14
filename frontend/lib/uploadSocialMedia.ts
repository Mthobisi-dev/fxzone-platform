import { api } from '@/lib/api';
import { supabase } from '@/lib/supabase';
import { isAllowedPostMedia, POST_MEDIA_BUCKET, shouldUseDirectPostUpload } from '@/lib/postUpload';

export async function uploadSocialMedia(file: File): Promise<string> {
  if (!isAllowedPostMedia(file.type, file.size)) throw new Error('Unsupported file type or file exceeds the upload size limit.');
  if (shouldUseDirectPostUpload(file.size)) {
    const signed = await api.post('/api/social/posts/upload-url', { type: file.type, size: file.size }, { timeoutMs: 15_000 });
    if (!signed || typeof signed.path !== 'string' || typeof signed.token !== 'string' || typeof signed.url !== 'string') throw new Error('Unable to authorize the upload.');
    const { error } = await supabase.storage.from(POST_MEDIA_BUCKET).uploadToSignedUrl(signed.path, signed.token, file, { contentType: file.type, upsert: false });
    if (error) throw new Error('Upload failed. Check your connection and retry.');
    return signed.url;
  }
  const data = new FormData(); data.append('file', file);
  const result = await api.post('/api/social/posts/upload', data, { timeoutMs: 60_000 });
  if (typeof result?.url !== 'string') throw new Error('Upload did not return a media URL.');
  return result.url;
}
