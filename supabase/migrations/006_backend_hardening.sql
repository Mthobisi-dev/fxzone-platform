-- ============================================================================
-- 006_backend_hardening.sql
--
-- Schema fixes required by the FxZone FastAPI backend (backend/).
-- Idempotent: safe to run more than once. Compatible with the legacy Next.js
-- API routes, so it can be applied BEFORE switching the frontend over.
--
-- Fixes:
--   1. participant_role enum lacked 'pending' (join_session RPC and the
--      approval flow could never work) and 'rejected'.
--   2. join_session(uuid, uuid) is SECURITY DEFINER and was callable by any
--      authenticated user with an arbitrary p_user_id -> now locked down.
--   3. posts/likes/comments/followers counters were maintained by racy
--      read-modify-write code -> now maintained by triggers.
--   4. Bookmarks used a non-existent `saved_posts` table in the old routes;
--      real table is `bookmarks` (now with RLS policies). Adds `reposts`.
--   5. Composer options (caption, show_*/allow_*) had no columns.
--   6. RLS let any signed-in user PATCH their own users.role via PostgREST
--      (privilege escalation) and edit counters -> guard triggers.
--   7. Indexes for the feed, search, stories and sessions.
--
-- Apply AFTER 001-005 (005_add_preferred_broker.sql redefines handle_new_user; nothing here conflicts with it).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Enum values
-- ----------------------------------------------------------------------------
ALTER TYPE participant_role ADD VALUE IF NOT EXISTS 'pending';
ALTER TYPE participant_role ADD VALUE IF NOT EXISTS 'rejected';

-- ----------------------------------------------------------------------------
-- 1b. users.preferred_broker (also added by 005_add_preferred_broker.sql; IF NOT EXISTS makes either order safe)
-- ----------------------------------------------------------------------------
ALTER TABLE users ADD COLUMN IF NOT EXISTS preferred_broker VARCHAR(100) DEFAULT 'Exness';

-- ----------------------------------------------------------------------------
-- 2. Posts: composer options + sanity limits
-- ----------------------------------------------------------------------------
ALTER TABLE posts
    ADD COLUMN IF NOT EXISTS caption TEXT,
    ADD COLUMN IF NOT EXISTS show_comments_count BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN IF NOT EXISTS show_likes_count    BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN IF NOT EXISTS allow_reshare       BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN IF NOT EXISTS allow_save          BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN IF NOT EXISTS allow_share         BOOLEAN NOT NULL DEFAULT true;

-- NOT VALID: enforced for new/updated rows without failing on legacy data.
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'posts_content_length') THEN
        ALTER TABLE posts ADD CONSTRAINT posts_content_length
            CHECK (char_length(content) <= 5000) NOT VALID;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'comments_content_length') THEN
        ALTER TABLE comments ADD CONSTRAINT comments_content_length
            CHECK (char_length(content) <= 2000) NOT VALID;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'messages_content_length') THEN
        ALTER TABLE messages ADD CONSTRAINT messages_content_length
            CHECK (char_length(content) <= 4000) NOT VALID;
    END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 3. Reposts (plain "repost" toggle; quote-reposts are ordinary posts)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS reposts (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    post_id    UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (user_id, post_id)
);
CREATE INDEX IF NOT EXISTS idx_reposts_post ON reposts(post_id);
ALTER TABLE reposts ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------------------------------------------
-- 4. News: numeric sentiment (headline aggregator writes this)
-- ----------------------------------------------------------------------------
ALTER TABLE news_articles ADD COLUMN IF NOT EXISTS sentiment_score REAL DEFAULT 0;

-- ----------------------------------------------------------------------------
-- 5. Atomic counters maintained by triggers (SECURITY DEFINER so the guard
--    triggers in section 6 do not block them)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fx_bump_post_counter() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    d   INT;
    pid UUID;
    rtype TEXT;
BEGIN
    IF TG_OP = 'INSERT' THEN d := 1;  pid := NEW.post_id;
    ELSE                     d := -1; pid := OLD.post_id;
    END IF;

    IF TG_TABLE_NAME = 'reactions' THEN
        IF TG_OP = 'INSERT' THEN rtype := NEW.reaction_type; ELSE rtype := OLD.reaction_type; END IF;
        IF rtype = 'like' THEN
            UPDATE posts SET likes_count = GREATEST(0, COALESCE(likes_count, 0) + d) WHERE id = pid;
        END IF;
    ELSIF TG_TABLE_NAME = 'comments' THEN
        UPDATE posts SET comments_count = GREATEST(0, COALESCE(comments_count, 0) + d) WHERE id = pid;
    ELSIF TG_TABLE_NAME = 'reposts' THEN
        UPDATE posts SET reposts_count = GREATEST(0, COALESCE(reposts_count, 0) + d) WHERE id = pid;
    END IF;
    RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS trg_reactions_counter ON reactions;
CREATE TRIGGER trg_reactions_counter AFTER INSERT OR DELETE ON reactions
    FOR EACH ROW EXECUTE FUNCTION fx_bump_post_counter();
DROP TRIGGER IF EXISTS trg_comments_counter ON comments;
CREATE TRIGGER trg_comments_counter AFTER INSERT OR DELETE ON comments
    FOR EACH ROW EXECUTE FUNCTION fx_bump_post_counter();
DROP TRIGGER IF EXISTS trg_reposts_counter ON reposts;
CREATE TRIGGER trg_reposts_counter AFTER INSERT OR DELETE ON reposts
    FOR EACH ROW EXECUTE FUNCTION fx_bump_post_counter();

CREATE OR REPLACE FUNCTION fx_bump_follow_counters() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    d INT;
    a UUID;  -- follower
    b UUID;  -- following
BEGIN
    IF TG_OP = 'INSERT' THEN d := 1;  a := NEW.follower_id; b := NEW.following_id;
    ELSE                     d := -1; a := OLD.follower_id; b := OLD.following_id;
    END IF;
    -- One statement touching both rows keeps lock ordering consistent.
    UPDATE users SET
        followers_count = GREATEST(0, COALESCE(followers_count, 0) + CASE WHEN id = b THEN d ELSE 0 END),
        following_count = GREATEST(0, COALESCE(following_count, 0) + CASE WHEN id = a THEN d ELSE 0 END)
    WHERE id IN (a, b);
    RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS trg_follows_counter ON follows;
CREATE TRIGGER trg_follows_counter AFTER INSERT OR DELETE ON follows
    FOR EACH ROW EXECUTE FUNCTION fx_bump_follow_counters();

-- One-time backfill of counters that were never (or wrongly) maintained.
-- reposts_count is deliberately NOT recomputed: legacy repost clicks only
-- incremented the number and were never recorded as rows.
UPDATE posts p SET
    likes_count    = (SELECT COUNT(*) FROM reactions r WHERE r.post_id = p.id AND r.reaction_type = 'like'),
    comments_count = (SELECT COUNT(*) FROM comments  c WHERE c.post_id = p.id);
UPDATE users u SET
    followers_count = (SELECT COUNT(*) FROM follows f WHERE f.following_id = u.id),
    following_count = (SELECT COUNT(*) FROM follows f WHERE f.follower_id  = u.id);

-- ----------------------------------------------------------------------------
-- 6. Guard triggers: direct PostgREST writes (roles anon/authenticated) must
--    not be able to escalate role, reactivate accounts, or forge counters.
--    The backend connects as the table owner / service role, so it is exempt.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fx_guard_users_write() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    IF current_user IN ('anon', 'authenticated') THEN
        IF TG_OP = 'INSERT' THEN
            NEW.role := 'trader';
            NEW.is_active := true;
            NEW.followers_count := 0;
            NEW.following_count := 0;
        ELSE
            NEW.role := OLD.role;
            NEW.is_active := OLD.is_active;
            NEW.followers_count := OLD.followers_count;
            NEW.following_count := OLD.following_count;
            NEW.email := OLD.email;
            NEW.password_hash := OLD.password_hash;
            NEW.created_at := OLD.created_at;
        END IF;
    END IF;
    RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_guard_users_write ON users;
CREATE TRIGGER trg_guard_users_write BEFORE INSERT OR UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION fx_guard_users_write();

CREATE OR REPLACE FUNCTION fx_guard_posts_write() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    IF current_user IN ('anon', 'authenticated') THEN
        IF TG_OP = 'INSERT' THEN
            NEW.likes_count := 0;
            NEW.comments_count := 0;
            NEW.reposts_count := 0;
        ELSE
            NEW.likes_count := OLD.likes_count;
            NEW.comments_count := OLD.comments_count;
            NEW.reposts_count := OLD.reposts_count;
            NEW.user_id := OLD.user_id;
            NEW.created_at := OLD.created_at;
        END IF;
    END IF;
    RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_guard_posts_write ON posts;
CREATE TRIGGER trg_guard_posts_write BEFORE INSERT OR UPDATE ON posts
    FOR EACH ROW EXECUTE FUNCTION fx_guard_posts_write();

CREATE OR REPLACE FUNCTION fx_guard_sessions_write() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    IF current_user IN ('anon', 'authenticated') THEN
        IF TG_OP = 'INSERT' THEN
            NEW.viewer_count := 0;
        ELSE
            NEW.viewer_count := OLD.viewer_count;
            NEW.host_id := OLD.host_id;
        END IF;
    END IF;
    RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_guard_sessions_write ON live_sessions;
CREATE TRIGGER trg_guard_sessions_write BEFORE INSERT OR UPDATE ON live_sessions
    FOR EACH ROW EXECUTE FUNCTION fx_guard_sessions_write();

-- ----------------------------------------------------------------------------
-- 7. join_session(): fix + lock down.
--    The enum now has 'pending', so the function works; and it must not be
--    callable through PostgREST with an arbitrary p_user_id.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION join_session(p_session_id UUID, p_user_id UUID)
RETURNS JSON AS $$
DECLARE
    v_session RECORD;
    v_participant RECORD;
    v_role participant_role;
    v_active_count INT;
BEGIN
    SELECT * INTO v_session FROM public.live_sessions WHERE id = p_session_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Session not found'; END IF;
    IF v_session.status = 'ended' THEN RAISE EXCEPTION 'Session has already ended'; END IF;

    IF v_session.host_id = p_user_id THEN v_role := 'host';
    ELSIF v_session.requires_approval THEN v_role := 'pending';
    ELSE v_role := 'viewer';
    END IF;

    SELECT COUNT(*) INTO v_active_count FROM public.session_participants
     WHERE session_id = p_session_id AND left_at IS NULL AND role NOT IN ('pending', 'rejected');

    IF v_session.max_participants IS NOT NULL AND v_active_count >= v_session.max_participants
       AND v_role NOT IN ('host', 'pending') THEN
        RAISE EXCEPTION 'Session is at full capacity';
    END IF;

    INSERT INTO public.session_participants (session_id, user_id, role, joined_at, left_at)
    VALUES (p_session_id, p_user_id, v_role, NOW(), NULL)
    ON CONFLICT (session_id, user_id)
    DO UPDATE SET role = EXCLUDED.role, joined_at = NOW(), left_at = NULL
    RETURNING * INTO v_participant;

    UPDATE public.live_sessions SET viewer_count = (
        SELECT COUNT(*) FROM public.session_participants
         WHERE session_id = p_session_id AND left_at IS NULL AND role NOT IN ('pending', 'rejected')
    ) WHERE id = p_session_id;

    RETURN row_to_json(v_participant);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION join_session(UUID, UUID) FROM PUBLIC;
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
        REVOKE ALL ON FUNCTION join_session(UUID, UUID) FROM anon;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
        REVOKE ALL ON FUNCTION join_session(UUID, UUID) FROM authenticated;
    END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 8. RLS policies for tables that had RLS enabled but no policies
-- ----------------------------------------------------------------------------
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'bookmarks' AND policyname = 'Users view own bookmarks') THEN
        CREATE POLICY "Users view own bookmarks"   ON bookmarks FOR SELECT USING (auth.uid() = user_id);
        CREATE POLICY "Users insert own bookmarks" ON bookmarks FOR INSERT WITH CHECK (auth.uid() = user_id);
        CREATE POLICY "Users delete own bookmarks" ON bookmarks FOR DELETE USING (auth.uid() = user_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'reposts' AND policyname = 'Reposts readable by all') THEN
        CREATE POLICY "Reposts readable by all"  ON reposts FOR SELECT USING (true);
        CREATE POLICY "Users insert own reposts" ON reposts FOR INSERT WITH CHECK (auth.uid() = user_id);
        CREATE POLICY "Users delete own reposts" ON reposts FOR DELETE USING (auth.uid() = user_id);
    END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 9. Indexes
-- ----------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS idx_users_username_trgm ON users USING gin (username gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_users_display_trgm  ON users USING gin (display_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_posts_feed          ON posts (created_at DESC, id DESC) WHERE is_story = false;
CREATE INDEX IF NOT EXISTS idx_posts_user_created  ON posts (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_posts_stories       ON posts (created_at DESC) WHERE is_story = true;
CREATE INDEX IF NOT EXISTS idx_comments_post_created ON comments (post_id, created_at);
CREATE INDEX IF NOT EXISTS idx_bookmarks_user_created ON bookmarks (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_post_tags_asset     ON post_asset_tags (asset_id);
CREATE INDEX IF NOT EXISTS idx_session_parts_user  ON session_participants (user_id);
CREATE INDEX IF NOT EXISTS idx_conversations_updated ON conversations (updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_news_symbols        ON news_articles USING gin (symbols);
