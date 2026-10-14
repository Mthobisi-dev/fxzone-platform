-- All fixture writes are rolled back; existing users are never modified.
BEGIN;
SET LOCAL statement_timeout='10s';
SELECT set_config('test.session',gen_random_uuid()::text,true);
SELECT set_config('test.host',(SELECT id::text FROM public.users LIMIT 1),true);
INSERT INTO public.live_sessions(id,host_id,title,status,requires_approval)
VALUES(current_setting('test.session')::uuid,current_setting('test.host')::uuid,'ROLLBACK ONLY realtime verification','live',true);
INSERT INTO public.session_participants(session_id,user_id,role)
VALUES(current_setting('test.session')::uuid,current_setting('test.host')::uuid,'host');
SELECT set_config('request.jwt.claim.sub',current_setting('test.host'),true);
SELECT set_config('realtime.topic','session_'||current_setting('test.session'),true);
SET LOCAL ROLE authenticated;
INSERT INTO realtime.messages(topic,extension,event,private,skip_broadcast)
VALUES(realtime.topic(),'broadcast','authorization-test',true,true);
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM realtime.messages WHERE topic=realtime.topic() AND event='authorization-test') THEN
 RAISE EXCEPTION 'Host cannot receive signaling'; END IF;
END $$;
RESET ROLE;
UPDATE public.session_participants SET role='pending' WHERE session_id=current_setting('test.session')::uuid;
SET LOCAL ROLE authenticated;
DO $$ DECLARE denied boolean:=false; BEGIN
 IF EXISTS(SELECT 1 FROM realtime.messages WHERE topic=realtime.topic() AND event='authorization-test') THEN
 RAISE EXCEPTION 'Pending user can receive signaling'; END IF;
 BEGIN
 INSERT INTO realtime.messages(topic,extension,event,private,skip_broadcast) VALUES(realtime.topic(),'broadcast','denied-test',true,true);
 EXCEPTION WHEN insufficient_privilege THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'Pending user can send signaling'; END IF;
END $$;
RESET ROLE;
UPDATE public.session_participants SET role='viewer' WHERE session_id=current_setting('test.session')::uuid;
SET LOCAL ROLE authenticated;
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM realtime.messages WHERE topic=realtime.topic() AND event='authorization-test') THEN
 RAISE EXCEPTION 'Approved viewer cannot receive signaling'; END IF;
END $$;
INSERT INTO realtime.messages(topic,extension,event,private,skip_broadcast) VALUES(realtime.topic(),'broadcast','viewer-test',true,true);
SELECT set_config('realtime.topic','session_'||gen_random_uuid()::text,true);
DO $$ DECLARE denied boolean:=false; BEGIN
 IF EXISTS(SELECT 1 FROM realtime.messages WHERE event='authorization-test') THEN RAISE EXCEPTION 'Nonmember can receive signaling'; END IF;
 BEGIN
 INSERT INTO realtime.messages(topic,extension,event,private,skip_broadcast) VALUES(realtime.topic(),'broadcast','denied-test',true,true);
 EXCEPTION WHEN insufficient_privilege THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'Nonmember can send signaling'; END IF;
END $$;
RESET ROLE;
ROLLBACK;
SELECT 'PASS: authenticated host/viewer read and write; pending and nonmember denied; rolled back' as realtime_verification;