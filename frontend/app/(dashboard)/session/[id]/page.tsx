'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { SessionRoom } from '@/components/live/SessionRoom';
import { Loader2, ShieldAlert, XCircle } from 'lucide-react';
import { api } from '@/lib/api';
import { canEnterLiveBroadcastRoom, getLiveSessionRoleLabel, type LiveSessionAdmissionRole } from '@/lib/liveSessionPermissions';

export default function SessionRoomPage() {
  const params = useParams();
  const router = useRouter();
  const { user, token, isAuthenticated, isLoading: isAuthLoading } = useAuth();
  const sessionId = params.id as string;
  const authReady = !isAuthLoading && isAuthenticated && Boolean(token);
  const userId = user?.id;

  const [session, setSession] = useState<any>(null);
  const [participant, setParticipant] = useState<any>(null);
  const [isPendingApproval, setIsPendingApproval] = useState(false);
  const [isRejected, setIsRejected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [requiresHostFollow, setRequiresHostFollow] = useState(false);
  const [isRequestingAccess, setIsRequestingAccess] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [isLeaving, setIsLeaving] = useState(false);
  const joinPromiseRef = useRef<{ key: string; promise: Promise<any> } | null>(null);
  const leavingRef = useRef(false);
  const accessKey = `${sessionId}:${userId}`;
  const activeRoomRef = useRef(accessKey);

  const fetchSessionDetails = async (isCurrent: () => boolean = () => true) => {
      const response = await api.get(`/api/sessions/${sessionId}`);
      if (response && isCurrent()) {
        setSession({
          ...response,
          hostId: response.host_id || response.hostId,
          host: {
            ...response.host,
            displayName: response.host?.display_name || response.host?.displayName,
            avatarUrl: response.host?.avatar_url || response.host?.avatarUrl,
            username: response.host?.username,
          },
        });
      }
      return response;
  };

  const joinSession = async (isCurrent: () => boolean = () => activeRoomRef.current === accessKey) => {
    if (leavingRef.current) return null;
    const pending = joinPromiseRef.current?.key === accessKey
      ? joinPromiseRef.current.promise
      : api.post(`/api/sessions/${sessionId}/join`);
    joinPromiseRef.current = { key: accessKey, promise: pending };
    setIsRequestingAccess(true);
    try {
      const response = await pending;
      if (response && isCurrent() && !leavingRef.current) {
        setParticipant(response);
        setIsPendingApproval(response.role === 'pending');
        setIsRejected(response.role === 'rejected');
        setJoinError(null);
        setRequiresHostFollow(false);
      }
      return response;
    } catch (err) {
      console.error('Error joining session:', err);
      const message = err instanceof Error ? err.message : 'Unable to join this live session.';
      if (isCurrent() && !leavingRef.current) {
        setJoinError(message);
        setRequiresHostFollow(/follow the host/i.test(message));
      }
      return null;
    } finally {
      if (joinPromiseRef.current?.promise === pending) joinPromiseRef.current = null;
      if (isCurrent() && !leavingRef.current) setIsRequestingAccess(false);
    }
  };

  useEffect(() => {
    // Do not attempt admission with a missing bearer token while Supabase Auth
    // restores its persisted session. A failed early join leaves no participant
    // row, so private Realtime correctly rejects the broadcast channel.
    if (isAuthLoading) return;

    if (!isAuthenticated || !token) {
      return;
    }

    let cancelled = false;
    activeRoomRef.current = accessKey;
    const enterSession = async () => {
      setLoading(true);
      setSession(null);
      setParticipant(null);
      setJoinError(null);
      setStatusError(null);
      setIsPendingApproval(false);
      setIsRejected(false);
      leavingRef.current = false;
      try {
        const details = await fetchSessionDetails(() => !cancelled);
        if (!cancelled && details) {
          if (details.status === 'ended') setJoinError('This broadcast has ended. Choose another live room.');
          else await joinSession(() => !cancelled);
        }
      } catch (error) {
        if (!cancelled) setJoinError(error instanceof Error ? error.message : 'Unable to load this broadcast. Please try again.');
      }
      if (!cancelled) setLoading(false);
    };

    void enterSession();
    return () => {
      cancelled = true;
      activeRoomRef.current = '';
    };
  // Refreshing the token must not rejoin and remount an active broadcast.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, authReady, userId]);

  // Pending users do not join the session signaling topic. Polling this
  // authenticated endpoint exposes only their own approval state until they
  // become an active participant and may enter the private session channel.
  useEffect(() => {
    if (!participant?.id || isRejected || !authReady) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    const checkAdmission = async () => {
        try {
          const response = await api.get(`/api/sessions/${sessionId}/join`);
          if (cancelled || leavingRef.current) return;
          if (response) {
            setStatusError(null);
            setParticipant(response);
            setIsPendingApproval(response.role === 'pending');
            setIsRejected(response.role === 'rejected');
            if (response.session_status === 'ended' || (response.left_at && response.role !== 'rejected')) {
              setJoinError('This broadcast has ended or your participation has expired.');
              return;
            }
          }
        } catch (e) {
          console.error('Error checking approval status:', e);
          if (!cancelled && (e as { status?: number }).status === 404) {
            setJoinError('This broadcast is no longer available.');
            return;
          }
          if (!cancelled) setStatusError('Connection interrupted. We’re checking your access again automatically.');
        }
        if (!cancelled) timer = setTimeout(checkAdmission, isPendingApproval ? 2500 : 5000);
    };
    timer = setTimeout(checkAdmission, 2500);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [isPendingApproval, isRejected, sessionId, participant?.id, authReady]);

  const handleLeave = async () => {
    if (leavingRef.current) return;
    leavingRef.current = true;
    setIsLeaving(true);
    try {
      // Complete any pending Join first so cancellation cannot strand a request.
      await joinPromiseRef.current?.promise.catch(() => null);
      await api.post(`/api/sessions/${sessionId}/leave`);
    } catch (e) {
      console.error(e);
      leavingRef.current = false;
      setIsLeaving(false);
      setStatusError('We could not leave the room. Please retry so your request is cancelled.');
      return;
    }
    router.push('/sessions');
  };

  const handleFollowAndRequestAccess = async () => {
    if (!session?.hostId || isRequestingAccess) return;
    setIsRequestingAccess(true);
    setJoinError(null);
    try {
      const follow = await api.post(`/api/social/users/${session.hostId}/follow`, { following: true });
      if (!follow?.is_following) throw new Error('Unable to follow the host. Please try again.');
      await joinSession();
    } catch (error) {
      setJoinError(error instanceof Error ? error.message : 'Unable to request access to this broadcast.');
    } finally {
      setIsRequestingAccess(false);
    }
  };

  if (!isAuthLoading && !authReady) {
    return <div className="p-6 text-sm" role="alert">Sign in to join this broadcast. <a className="text-blue-400 underline" href="/login">Log in</a></div>;
  }

  if (loading) {
    return (
      <div className="h-96 flex flex-col items-center justify-center gap-2">
        <Loader2 className="animate-spin text-blue-500" size={24} />
        <span className="text-sm text-zinc-400">Opening your broadcast…</span>
      </div>
    );
  }

  if (!session && !joinError) {
    return (
      <div className="h-96 flex flex-col items-center justify-center text-center p-6 select-none">
        <h4 className="text-xs font-bold text-zinc-300">Room Unavailable</h4>
        <p className="text-[10px] text-zinc-500 max-w-[200px] mt-1 mb-4 leading-relaxed">
          The requested broadcast session does not exist or has already been terminated.
        </p>
        <button
          onClick={() => router.push('/sessions')}
          className="text-xs font-semibold text-blue-400 hover:text-blue-300 underline"
        >
          Return to listings
        </button>
      </div>
    );
  }

  if (joinError) {
    return (
      <div className="h-[calc(100vh-64px-32px)] flex flex-col items-center justify-center text-center p-6 select-none bg-zinc-950">
        <div className="h-12 w-12 rounded-full bg-rose-500/10 border border-rose-500/30 flex items-center justify-center mb-4 text-rose-500">
          <ShieldAlert size={24} />
        </div>
        <h4 className="text-lg font-semibold text-white">{requiresHostFollow ? 'Join this broadcast' : 'Unable to join yet'}</h4>
        <p className="text-sm text-zinc-400 max-w-sm mt-2 mb-6 leading-relaxed">
          {requiresHostFollow
            ? 'This broadcast is limited to followers. Follow the host, then your access request will be sent for their approval.'
            : joinError}
        </p>
        {requiresHostFollow ? (
          <button
            onClick={() => void handleFollowAndRequestAccess()}
            disabled={isRequestingAccess}
            className="min-h-11 px-4 bg-blue-600 hover:bg-blue-500 border border-blue-400/40 rounded-lg text-sm font-semibold text-white transition-colors disabled:cursor-wait disabled:opacity-60"
          >
            {isRequestingAccess ? 'Requesting access…' : 'Follow & Request Access'}
          </button>
        ) : (
          <button
            onClick={() => {
              if (!session) window.location.reload();
              else void joinSession();
            }}
            disabled={isRequestingAccess}
            className="min-h-11 px-4 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-lg text-sm font-semibold text-zinc-300 transition-colors disabled:opacity-60"
          >
            {isRequestingAccess ? 'Requesting access…' : 'Try again'}
          </button>
        )}
        <button onClick={() => router.push('/sessions')} className="mt-4 min-h-11 text-sm text-blue-400 underline">Back to live rooms</button>
      </div>
    );
  }

  if (isRejected) {
    return (
      <div className="h-[calc(100vh-64px-32px)] flex flex-col items-center justify-center text-center p-6 select-none bg-zinc-950">
        <div className="h-12 w-12 rounded-full bg-rose-500/10 border border-rose-500/30 flex items-center justify-center mb-4 text-rose-500">
          <XCircle size={24} />
        </div>
        <h4 className="text-xs font-bold text-white uppercase tracking-wider">Access Request Declined</h4>
        <p className="text-[10px] text-zinc-500 max-w-[280px] mt-2 mb-6 leading-relaxed">
          The host of this live room did not approve your request to join this session.
        </p>
        <button
          onClick={handleLeave}
          className="h-8 px-4 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-lg text-xs font-semibold text-zinc-300 transition-colors"
        >
          Return to Listings
        </button>
      </div>
    );
  }

  if (isPendingApproval) {
    return (
      <div className="h-[calc(100vh-64px-32px)] flex flex-col items-center justify-center text-center p-6 select-none bg-zinc-950">
        <div className="h-12 w-12 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center mb-4">
          <Loader2 size={20} className="text-purple-400 animate-spin" />
        </div>
        <h4 className="text-lg font-semibold text-white" role="status">Request sent to {session.host?.displayName || session.host?.username}</h4>
        <p className="text-sm text-zinc-400 max-w-sm mt-2 mb-6 leading-relaxed">
          You’ll enter automatically when the host approves you. Keep this page open; you don’t need to request again.
        </p>
        {statusError && <p className="mb-4 max-w-sm text-sm text-amber-500" role="alert">{statusError}</p>}
        <button
          onClick={handleLeave}
          disabled={isLeaving}
          className="min-h-11 px-4 bg-zinc-900 hover:bg-zinc-800 border border-zinc-850 rounded-lg text-sm font-semibold text-zinc-300 transition-colors disabled:opacity-60"
        >
          {isLeaving ? 'Cancelling…' : 'Cancel request'}
        </button>
      </div>
    );
  }

  const participantRole = (participant?.role ?? null) as LiveSessionAdmissionRole;
  const isHost = user?.id === session.hostId && participantRole === 'host';

  if (!canEnterLiveBroadcastRoom(participantRole)) {
    return (
      <div className="h-[calc(100vh-64px-32px)] flex flex-col items-center justify-center text-center p-6 select-none bg-zinc-950">
        <ShieldAlert size={24} className="text-amber-400" />
        <h4 className="mt-3 text-xs font-bold text-white uppercase tracking-wider">Access not active</h4>
        <p className="mt-2 max-w-xs text-[10px] leading-relaxed text-zinc-500">Your current room status is {getLiveSessionRoleLabel(participantRole).toLowerCase()}. Wait for the host to approve your request.</p>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100dvh-6rem)] xl:h-[calc(100dvh-6rem)] flex flex-col bg-zinc-950">
      {statusError && <p role="alert" className="p-3 text-sm text-amber-500">{statusError}</p>}
      <SessionRoom
        sessionId={session.id}
        sessionTitle={session.title}
        hostName={session.host?.displayName || session.host?.username || 'Host'}
        hostId={session.hostId}
        isHost={isHost}
        onLeave={handleLeave}
      />
    </div>
  );
}
