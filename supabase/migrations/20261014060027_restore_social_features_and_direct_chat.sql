BEGIN;
ALTER TABLE public.posts
 ADD COLUMN IF NOT EXISTS caption text,
 ADD COLUMN IF NOT EXISTS asset_tags text[] NOT NULL DEFAULT '{}',
 ADD COLUMN IF NOT EXISTS show_comments_count boolean NOT NULL DEFAULT true,
 ADD COLUMN IF NOT EXISTS show_likes_count boolean NOT NULL DEFAULT true,
 ADD COLUMN IF NOT EXISTS allow_reshare boolean NOT NULL DEFAULT true,
 ADD COLUMN IF NOT EXISTS allow_save boolean NOT NULL DEFAULT true,
 ADD COLUMN IF NOT EXISTS allow_share boolean NOT NULL DEFAULT true;
CREATE TABLE IF NOT EXISTS public.reposts (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
 user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(user_id,post_id)
);
ALTER TABLE public.reposts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.reposts FROM anon,authenticated;
GRANT ALL ON public.reposts TO service_role;
CREATE INDEX IF NOT EXISTS reposts_post_id_idx ON public.reposts(post_id);

-- Increment atomically on the same locked post row; no count-then-write race.
CREATE OR REPLACE FUNCTION public.sync_social_counter() RETURNS trigger
LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE target uuid; delta integer; field text;
BEGIN
 target:=CASE WHEN TG_OP='DELETE' THEN OLD.post_id ELSE NEW.post_id END;
 delta:=CASE WHEN TG_OP='DELETE' THEN -1 ELSE 1 END;
 IF TG_TABLE_NAME='reactions' THEN
  IF (CASE WHEN TG_OP='DELETE' THEN OLD.reaction_type ELSE NEW.reaction_type END) <> 'like' THEN RETURN NULL; END IF;
  field:='likes_count';
 ELSIF TG_TABLE_NAME='comments' THEN field:='comments_count';
 ELSE field:='reposts_count';
 END IF;
 EXECUTE format('UPDATE public.posts SET %I=greatest(0,coalesce(%I,0)+$1) WHERE id=$2',field,field) USING delta,target;
 RETURN NULL;
END $$;
REVOKE ALL ON FUNCTION public.sync_social_counter() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS fxzone_reaction_count ON public.reactions;
CREATE TRIGGER fxzone_reaction_count AFTER INSERT OR DELETE ON public.reactions FOR EACH ROW EXECUTE FUNCTION public.sync_social_counter();
DROP TRIGGER IF EXISTS fxzone_comment_count ON public.comments;
CREATE TRIGGER fxzone_comment_count AFTER INSERT OR DELETE ON public.comments FOR EACH ROW EXECUTE FUNCTION public.sync_social_counter();
DROP TRIGGER IF EXISTS fxzone_repost_count ON public.reposts;
CREATE TRIGGER fxzone_repost_count AFTER INSERT OR DELETE ON public.reposts FOR EACH ROW EXECUTE FUNCTION public.sync_social_counter();
UPDATE public.posts p SET
 likes_count=(SELECT count(*) FROM public.reactions r WHERE r.post_id=p.id AND r.reaction_type='like'),
 comments_count=(SELECT count(*) FROM public.comments c WHERE c.post_id=p.id),
 reposts_count=(SELECT count(*) FROM public.reposts r WHERE r.post_id=p.id);

-- Serialize creation for a sorted pair, including requests from both people.
-- Server verifies the access token; only service_role may supply actor IDs.
CREATE OR REPLACE FUNCTION public.get_or_create_direct_conversation(p_user uuid,p_other uuid)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE result public.conversations; pair text;
BEGIN
 IF p_user IS NULL OR p_other IS NULL OR p_user=p_other THEN RAISE EXCEPTION 'Two different users required' USING ERRCODE='22023'; END IF;
 pair:=least(p_user::text,p_other::text)||':'||greatest(p_user::text,p_other::text);
 PERFORM pg_advisory_xact_lock(hashtextextended(pair,0));
 SELECT c.* INTO result FROM public.conversations c
 WHERE c.is_group=false
 AND EXISTS(SELECT 1 FROM public.conversation_members m WHERE m.conversation_id=c.id AND m.user_id=p_user)
 AND EXISTS(SELECT 1 FROM public.conversation_members m WHERE m.conversation_id=c.id AND m.user_id=p_other)
 AND (SELECT count(*) FROM public.conversation_members m WHERE m.conversation_id=c.id)=2
 ORDER BY c.created_at,c.id LIMIT 1;
 IF NOT FOUND THEN
  INSERT INTO public.conversations(is_group,creator_id) VALUES(false,p_user) RETURNING * INTO result;
  INSERT INTO public.conversation_members(conversation_id,user_id) VALUES(result.id,p_user),(result.id,p_other);
 END IF;
 RETURN row_to_json(result);
END $$;
REVOKE ALL ON FUNCTION public.get_or_create_direct_conversation(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.get_or_create_direct_conversation(uuid,uuid) TO service_role;
-- Private chat signaling policies need a visible membership row for the caller.
GRANT SELECT(conversation_id,user_id) ON public.conversation_members TO authenticated;
DROP POLICY IF EXISTS fxzone_read_own_chat_membership ON public.conversation_members;
CREATE POLICY fxzone_read_own_chat_membership ON public.conversation_members FOR SELECT TO authenticated USING(user_id=(select auth.uid()));
NOTIFY pgrst,'reload schema';
COMMIT;