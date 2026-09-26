-- Reliable social interaction counts and an idempotent admin-role promotion.
-- Apply through the Supabase SQL editor or migration pipeline.

ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS saves_count INTEGER NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.fx_bump_post_counter() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  delta INTEGER := CASE WHEN TG_OP = 'INSERT' THEN 1 ELSE -1 END;
  post_id_value UUID := CASE WHEN TG_OP = 'INSERT' THEN NEW.post_id ELSE OLD.post_id END;
  reaction_value TEXT := CASE WHEN TG_OP = 'INSERT' THEN NEW.reaction_type ELSE OLD.reaction_type END;
BEGIN
  IF TG_TABLE_NAME = 'reactions' AND reaction_value = 'like' THEN
    UPDATE public.posts SET likes_count = GREATEST(0, COALESCE(likes_count, 0) + delta) WHERE id = post_id_value;
  ELSIF TG_TABLE_NAME = 'comments' THEN
    UPDATE public.posts SET comments_count = GREATEST(0, COALESCE(comments_count, 0) + delta) WHERE id = post_id_value;
  ELSIF TG_TABLE_NAME = 'reposts' THEN
    UPDATE public.posts SET reposts_count = GREATEST(0, COALESCE(reposts_count, 0) + delta) WHERE id = post_id_value;
  ELSIF TG_TABLE_NAME = 'bookmarks' THEN
    UPDATE public.posts SET saves_count = GREATEST(0, COALESCE(saves_count, 0) + delta) WHERE id = post_id_value;
  END IF;
  RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS trg_bookmarks_counter ON public.bookmarks;
CREATE TRIGGER trg_bookmarks_counter AFTER INSERT OR DELETE ON public.bookmarks
  FOR EACH ROW EXECUTE FUNCTION public.fx_bump_post_counter();

UPDATE public.posts AS post
SET
  likes_count = (SELECT COUNT(*) FROM public.reactions reaction WHERE reaction.post_id = post.id AND reaction.reaction_type = 'like'),
  comments_count = (SELECT COUNT(*) FROM public.comments comment WHERE comment.post_id = post.id),
  reposts_count = (SELECT COUNT(*) FROM public.reposts repost WHERE repost.post_id = post.id),
  saves_count = (SELECT COUNT(*) FROM public.bookmarks bookmark WHERE bookmark.post_id = post.id);

-- This is safe to run before or after the Auth account is created: it only
-- promotes the matching application profile and never stores a password.
UPDATE public.users
SET role = 'admin'
WHERE LOWER(email) = 'admin@fxzone.io' AND role IS DISTINCT FROM 'admin';
