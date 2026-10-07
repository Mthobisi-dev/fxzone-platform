'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { SessionRoom } from '@/components/live/SessionRoom';
import { Loader2, ShieldAlert, XCircle } from 'lucide-react';
import { api } from '@/lib/api';

export default function SessionRoomPage() {
  const params = useParams();
  const router = useRouter();
  const { user, token, isAuthenticated, isLoading: isAuthLoading } = useAuth();
  const sessionId = params.id as string;

  const [session, setSession] = useState<any>(null);
  const [participant, setParticipant] = useState<any>(null);
  const [isPendingApproval, setIsPendingApproval] = useState(false);
  const [isRejected, setIsRejected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [joinError, setJoinError] = useState<string | null>(null);

  const fetchSessionDetails = async () => {
    try {
      const response = await api.get(`/api/sessions/${sessionId}`);
      if (response) {
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
    } catch (err) {
      console.error('Error fetching session details:', err);
    }
  };

  const joinSession = async () => {
    try {
      const response = await api.post(`/api/sessions/${sessionId}/join`);
      if (response) {
        setParticipant(response);
        setIsPendingApproval(response.role === 'pending');
        setIsRejected(response.role === 'rejected');
        setJoinError(null);
      }
      return response;
    } catch (err) {
      console.error('Error joining session:', err);
      const message = err instanceof Error ? err.message : 'Unable to join this live session.';
      setJoinError(message);
      return null;
    }
  };

  useEffect(() => {
    // Do not attempt admission with a missing bearer token while Supabase Auth
    // restores its persisted session. A failed early join leaves no participant
    // row, so private Realtime correctly rejects the broadcast channel.
    if (isAuthLoading) return;

    if (!isAuthenticated || !token) {
      setJoinError('Sign in is required before joining a live session.');
      setLoading(false);
      return;
    }

    let cancelled = false;
    const enterSession = async () => {
      await fetchSessionDetails();
      if (!cancelled) {
        await joinSession();
      }
      if (!cancelled) setLoading(false);
    };

    void enterSession();
    return () => {
      cancelled = true;
    };
  }, [sessionId, isAuthLoading, isAuthenticated, token]);

  // Pending users do not join the session signaling topic. Polling this
  // authenticated endpoint exposes only their own approval state until they
  // become an active participant and may enter the private session channel.
  useEffect(() => {
    let interval: any;
    if (isPendingApproval && !isRejected) {
      interval = setInterval(async () => {
        try {
          const response = await api.post(`/api/sessions/${sessionId}/join`);
          if (response && response.role !== 'pending') {
            setParticipant(response);
            setIsPendingApproval(false);
            setIsRejected(response.role === 'rejected');
            clearInterval(interval);
          }
        } catch (e) {
          console.error('Error checking approval status:', e);
        }
      }, 2500);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isPendingApproval, isRejected, sessionId]);

  const handleLeave = async () => {
    try {
      await api.post(`/api/sessions/${sessionId}/leave`);
    } catch (e) {
      console.error(e);
    }
    router.push('/sessions');
  };

  if (loading) {
    return (
      <div className="h-96 flex flex-col items-center justify-center gap-2">
        <Loader2 className="animate-spin text-blue-500" size={24} />
        <span className="text-xs text-zinc-550 font-semibold">Connecting to signaling room...</span>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="h-96 flex flex-col items-center justify-center text-center p-6 select-none">
        <h4 className="text-xs font-bold text-zinc-300">Room Unavailable</h4>
        <p className="text-[10px] text-zinc-500 max-w-[200px] mt-1 mb-4 leading-relaxed">
          The requested broadcast session does not exist or has already been terminated.
        </p>
        <button
          onClick={handleLeave}
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
        <h4 className="text-xs font-bold text-white uppercase tracking-wider">Unable to Join Broadcast</h4>
        <p className="text-[10px] text-zinc-500 max-w-[320px] mt-2 mb-6 leading-relaxed">{joinError}</p>
        <button
          onClick={() => window.location.reload()}
          className="h-8 px-4 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-lg text-xs font-semibold text-zinc-300 transition-colors"
        >
          Retry Connection
        </button>
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
        <h4 className="text-xs font-bold text-white uppercase tracking-wider">Awaiting Host Approval</h4>
        <p className="text-[10px] text-zinc-500 max-w-[280px] mt-2 mb-6 leading-relaxed">
          The host of this live room (&quot;{session.host?.displayName || session.host?.username}&quot;) must authorize your access request before you can enter the feed.
        </p>
        <button
          onClick={handleLeave}
          className="h-8 px-4 bg-zinc-900 hover:bg-zinc-800 border border-zinc-850 rounded-lg text-xs font-semibold text-zinc-300 transition-colors"
        >
          Cancel Request & Return
        </button>
      </div>
    );
  }

  const isHost = user?.id === session.hostId;

  return (
    <div className="h-[calc(100vh-64px-32px)] flex flex-col bg-zinc-950">
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
