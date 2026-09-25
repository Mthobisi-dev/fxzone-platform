-- Keep existing social counters accurate after the interaction routes were hardened.
-- Safe to apply after 006_backend_hardening.sql.

UPDATE public.posts AS post
SET
  likes_count = (SELECT COUNT(*) FROM public.reactions AS reaction WHERE reaction.post_id = post.id AND reaction.reaction_type = 'like'),
  comments_count = (SELECT COUNT(*) FROM public.comments AS comment WHERE comment.post_id = post.id),
  reposts_count = (SELECT COUNT(*) FROM public.reposts AS repost WHERE repost.post_id = post.id);

-- Protect the preferred-broker field for profiles created before migration 005.
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS preferred_broker VARCHAR(100) DEFAULT 'Exness';
UPDATE public.users
SET preferred_broker = 'Exness'
WHERE preferred_broker IS NULL OR BTRIM(preferred_broker) = '';
ALTER TABLE public.users ALTER COLUMN preferred_broker SET DEFAULT 'Exness';