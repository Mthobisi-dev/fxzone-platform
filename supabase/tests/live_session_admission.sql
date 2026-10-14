-- All fixture writes are rolled back; existing users are never modified.
BEGIN;
SET LOCAL statement_timeout='10s';
DO $test$
DECLARE
 test_session uuid := gen_random_uuid();
 host_user uuid; follower_user uuid; outsider uuid;
 participant json; denied boolean;
BEGIN
 SELECT following_id,follower_id INTO host_user,follower_user
 FROM public.follows WHERE following_id <> follower_id LIMIT 1;
 IF host_user IS NULL THEN RAISE EXCEPTION 'Test requires an existing follow relation'; END IF;
 SELECT u.id INTO outsider FROM public.users u
 WHERE u.id NOT IN(host_user,follower_user)
 AND NOT EXISTS(SELECT 1 FROM public.follows f WHERE f.follower_id=u.id AND f.following_id=host_user)
 LIMIT 1;
 IF outsider IS NULL THEN RAISE EXCEPTION 'Test requires a nonfollower'; END IF;
 INSERT INTO public.live_sessions(id,host_id,title,status,requires_approval,max_participants)
 VALUES(test_session,host_user,'ROLLBACK ONLY admission verification','live',true,10);
 participant:=public.join_session(test_session,host_user);
 IF participant->>'role' IS DISTINCT FROM 'host' THEN RAISE EXCEPTION 'Host was not admitted as host'; END IF;
 participant:=public.join_session(test_session,follower_user);
 IF participant->>'role' IS DISTINCT FROM 'pending' THEN RAISE EXCEPTION 'Follower entered without approval'; END IF;
 denied:=false;
 BEGIN PERFORM public.join_session(test_session,outsider);
 EXCEPTION WHEN insufficient_privilege THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'Nonfollower was admitted'; END IF;
 denied:=false;
 BEGIN PERFORM public.review_session_participant(test_session,outsider,follower_user,'approve');
 EXCEPTION WHEN insufficient_privilege THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'Nonhost could approve'; END IF;
 participant:=public.review_session_participant(test_session,host_user,follower_user,'approve');
 IF participant->>'role' IS DISTINCT FROM 'viewer' THEN RAISE EXCEPTION 'Host approval did not admit viewer'; END IF;
 UPDATE public.session_participants SET role='pending' WHERE session_id=test_session AND user_id=host_user;
 participant:=public.join_session(test_session,host_user);
 IF participant->>'role' IS DISTINCT FROM 'host' THEN RAISE EXCEPTION 'Stale host membership was not restored'; END IF;
END $test$;
ROLLBACK;
SELECT 'PASS: host, follower pending, nonfollower denied, nonhost denied, host approval, stale host repair; transaction rolled back' as admission_verification;