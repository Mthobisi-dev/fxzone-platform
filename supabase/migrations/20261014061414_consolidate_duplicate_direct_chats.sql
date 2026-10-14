BEGIN;
ALTER TABLE public.conversations ADD COLUMN IF NOT EXISTS canonical_conversation_id uuid REFERENCES public.conversations(id);
-- Keep old conversation IDs as redirects; move messages, never delete them.
LOCK TABLE public.conversations, public.conversation_members, public.messages IN SHARE ROW EXCLUSIVE MODE;
DO $$ DECLARE pair record; ids uuid[]; keep_id uuid; old_id uuid; BEGIN
 FOR pair IN
  SELECT members FROM (
   SELECT c.id,array_agg(m.user_id ORDER BY m.user_id) members
   FROM public.conversations c JOIN public.conversation_members m ON m.conversation_id=c.id
   WHERE c.is_group=false AND c.canonical_conversation_id IS NULL
   GROUP BY c.id HAVING count(*)=2
  ) x GROUP BY members HAVING count(*)>1
 LOOP
  PERFORM pg_advisory_xact_lock(hashtextextended(pair.members[1]::text||':'||pair.members[2]::text,0));
  SELECT array_agg(c.id ORDER BY c.created_at,c.id) INTO ids FROM public.conversations c
  WHERE c.is_group=false AND c.canonical_conversation_id IS NULL
  AND (SELECT array_agg(m.user_id ORDER BY m.user_id) FROM public.conversation_members m WHERE m.conversation_id=c.id)=pair.members;
  keep_id:=ids[1];
  FOREACH old_id IN ARRAY ids[2:array_length(ids,1)] LOOP
   UPDATE public.messages SET conversation_id=keep_id WHERE conversation_id=old_id;
   UPDATE public.conversations SET canonical_conversation_id=keep_id WHERE id=old_id;
  END LOOP;
 END LOOP;
END $$;
NOTIFY pgrst,'reload schema';
COMMIT;