-- Create the bucket used by social-post attachments.
-- Uploads go through the authenticated Next.js route with the service role;
-- users never receive direct write access to storage.objects.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'post-media',
  'post-media',
  true,
  52428800,
  ARRAY[
    'image/jpeg', 'image/png', 'image/gif', 'image/webp',
    'video/mp4', 'video/quicktime', 'video/webm', 'video/x-matroska',
    'audio/webm', 'audio/mp3', 'audio/mpeg', 'audio/wav', 'audio/ogg',
    'application/pdf'
  ]
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;
