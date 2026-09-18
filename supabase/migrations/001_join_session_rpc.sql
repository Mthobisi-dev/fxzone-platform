-- Supabase RPC Migration: Atomic Session Join & Viewer Count Management
-- Execute this SQL script in your Supabase SQL Editor if you wish to enforce atomic limits at the DB transaction level.

CREATE OR REPLACE FUNCTION join_session(p_session_id UUID, p_user_id UUID)
RETURNS JSON AS $$
DECLARE
  v_session RECORD;
  v_participant RECORD;
  v_role TEXT;
  v_active_count INT;
BEGIN
  -- 1. Lock the live session row for update
  SELECT * INTO v_session
  FROM public.live_sessions
  WHERE id = p_session_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Session not found';
  END IF;

  IF v_session.status = 'ended' THEN
    RAISE EXCEPTION 'Session has already ended';
  END IF;

  -- 2. Check if host
  IF v_session.host_id = p_user_id THEN
    v_role := 'host';
  ELSIF v_session.requires_approval THEN
    v_role := 'pending';
  ELSE
    v_role := 'viewer';
  END IF;

  -- 3. Check capacity if max_participants is configured
  SELECT COUNT(*) INTO v_active_count
  FROM public.session_participants
  WHERE session_id = p_session_id
    AND left_at IS NULL
    AND role != 'pending';

  IF v_session.max_participants IS NOT NULL AND v_active_count >= v_session.max_participants AND v_role != 'host' THEN
    RAISE EXCEPTION 'Session is at full capacity';
  END IF;

  -- 4. Insert or update participant status
  INSERT INTO public.session_participants (session_id, user_id, role, joined_at, left_at)
  VALUES (p_session_id, p_user_id, v_role, NOW(), NULL)
  ON CONFLICT (session_id, user_id)
  DO UPDATE SET role = EXCLUDED.role, joined_at = NOW(), left_at = NULL
  RETURNING * INTO v_participant;

  -- 5. Update viewer count atomically
  SELECT COUNT(*) INTO v_active_count
  FROM public.session_participants
  WHERE session_id = p_session_id
    AND left_at IS NULL
    AND role != 'pending';

  UPDATE public.live_sessions
  SET viewer_count = v_active_count
  WHERE id = p_session_id;

  RETURN row_to_json(v_participant);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
