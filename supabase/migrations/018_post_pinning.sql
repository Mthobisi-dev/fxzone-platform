-- Ensure every installation supports persistent post pinning.
ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS is_pinned BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_posts_pinned_created_at
  ON public.posts (is_pinned DESC, created_at DESC)
  WHERE is_story = false;
