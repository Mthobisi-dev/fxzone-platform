'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ScreenShare } from './ScreenShare';
import { SessionChat, SessionChatMessage } from './SessionChat';
import { SessionControls } from './SessionControls';
import { useAuth } from '@/hooks/useAuth';
import { useHydrated } from '@/hooks/useHydrated';
import { useWebSocket } from '@/hooks/useWebSocket';
import {
  Shield,
  Users,
  AlertTriangle,
  Check,
  X,
  Clock,
  Disc,
} from 'lucide-react';
import { WebRTCClient } from '@/lib/webrtc';
import { broadcastCaptureOptions, stopBroadcastTracks } from '@/lib/broadcastMedia';
import { api } from '@/lib/api';
import { canControlLiveBroadcastMedia, canEndLiveBroadcast } from '@/lib/liveSessionPermissions';
import { Button } from '../ui/Button';
import { Avatar } from '../ui/Avatar';
import { getScreenShareCapability, screenShareUnavailableMessage, type ShareCapability } from '@/lib/screenShareCapability';

interface SessionRoomProps {
  sessionId: string;
  sessionTitle: string;
  hostName: string;
  hostId: string;
  isHost: boolean;
  onLeave: () => void;
}

export function SessionRoom({
  sessionId,
  sessionTitle,
  hostName,
  hostId,
  isHost,
  onLeave,
}: SessionRoomProps) {
  const { user, token, isAuthenticated } = useAuth();
  const userId = user?.id;
  const username = user?.username;

  // ─── UI state ────────────────────────────────────────────────────────────────
  const [participantsCount, setParticipantsCount] = useState(1);
  const [activeStream, setActiveStream] = useState<MediaStream | null>(null);
  const [isSharingScreen, setIsSharingScreen] = useState(false);
  const [remotePresenterName, setRemotePresenterName] = useState('');
  const [chatMessages, setChatMessages] = useState<SessionChatMessage[]>([]);
  const [copilotAlerts, setCopilotAlerts] = useState<string[]>([]);
  const [participants, setParticipants] = useState<any[]>([]);
  const [shareTimeLeft, setShareTimeLeft] = useState<number | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [isRoomBeingRecorded, setIsRoomBeingRecorded] = useState(false);
  const [signalingStatus, setSignalingStatus] = useState<'connecting' | 'connected' | 'reconnecting' | 'unavailable'>('connecting');
  const [broadcastError, setBroadcastError] = useState<string | null>(null);
  const [approvalError, setApprovalError] = useState<string | null>(null);
  const [reviewingParticipantId, setReviewingParticipantId] = useState<string | null>(null);
  const [isEndingBroadcast, setIsEndingBroadcast] = useState(false);
  const [isStartingShare, setIsStartingShare] = useState(false);
  const [captureSurface, setCaptureSurface] = useState<string | null>(null);
  const hydrated = useHydrated();
  const screenShareCapability: ShareCapability = hydrated && typeof navigator !== 'undefined'
    ? getScreenShareCapability(navigator)
    : 'unsupported';
  const screenShareSupported = screenShareCapability === 'supported';
  const [hasSharedAudio, setHasSharedAudio] = useState(false);
  const capturePendingRef = useRef(false);

  // ─── Refs (never go stale in callbacks) ─────────────────────────────────────
  // The WebRTC client lives in a ref so it is NEVER re-created when state changes.
  const rtcClientRef = useRef<WebRTCClient | null>(null);
  const isSharingRef = useRef(false);          // mirrors isSharingScreen without closure staleness
  const activeStreamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<any>(null);
  const shareTimerRef = useRef<any>(null);
  const participantFetchRef = useRef<any>(null);

  // Admin override detection
  const isAdmin = user?.role === 'admin';
  const canControlBroadcast = canControlLiveBroadcastMedia(isHost);
  const canEndBroadcast = canEndLiveBroadcast({ isHost, isAdmin });

  // ─── WebSocket ────────────────────────────────────────────────────────────────
  // IMPORTANT: rtc_signal handler reads from rtcClientRef (not stale state).
  const socketRef = useWebSocket(`/ws/session/${sessionId}`, {
    open: () => {
      // The stream may have been selected before the signaling room finished
      // its private authorization. FxZoneWebSocket flushes queued signals now.
      console.info('Live session signaling connected');
      setSignalingStatus('connected');

      // Broadcast events are not retained. Re-announce on every successful
      // channel join so a host or viewer that reconnects can establish (or
      // retain) the WebRTC peer relationship instead of remaining idle.
      if (user) {
        socketRef.current?.send({
          type: 'rtc_signal',
          data: {
            type: 'peer_joined',
            user_id: user.id,
            username: user.username,
          },
        });
        if (isSharingRef.current) {
          socketRef.current?.send({ type: 'rtc_signal', data: {
            type: 'presenter_stream_started', sender_id: user.id, sender_username: user.username,
          } });
        }
      }
    },
    close: (details) => {
      setSignalingStatus(details?.reason === 'Max reconnect attempts reached' || details?.reason === 'Realtime authentication is unavailable'
        ? 'unavailable'
        : 'reconnecting');
    },
    error: (error) => {
      console.error('Live session signaling error:', error);
      setSignalingStatus('reconnecting');
    },
    chat_message: (payload) => {
      const msg = payload.data as SessionChatMessage;
      if (msg?.id) setChatMessages((prev) => prev.some((item) => item.id === msg.id) ? prev : [...prev.slice(-199), msg]);
    },
    rtc_signal: (payload) => {
      // Always use the ref — never a captured stale closure value.
      rtcClientRef.current?.handleSignal(payload.data || payload);
    },
    members_update: (payload) => {
      setParticipantsCount(payload.data?.count || payload.count || 1);
    },
    participant_approved: () => {
      fetchParticipants();
      // If we are currently presenting, announce stream so newly approved viewer gets the offer.
      if (isSharingRef.current && rtcClientRef.current) {
        socketRef.current?.send({
          type: 'rtc_signal',
          data: { type: 'presenter_stream_started', active: true, sender_id: userId, sender_username: username },
        });
      }
    },
    participant_rejected: () => fetchParticipants(),
    recording_status: (payload) => {
      const recData = payload.data || payload;
      setIsRoomBeingRecorded(!!recData.isRecording);
    },
    session_ended: () => {
      alert('This live session has been ended by the host or platform administrator.');
      onLeave();
    },
    ai_copilot_alert: (payload) => {
      setCopilotAlerts((prev) => [payload.data.message, ...prev].slice(0, 3));
    },
  }, Boolean(user && token && isAuthenticated));

  // ─── Participants ─────────────────────────────────────────────────────────────
  const fetchParticipants = useCallback(async () => {
    try {
      const res = await api.get(`/api/sessions/${sessionId}/participants`);
      if (Array.isArray(res)) {
        setParticipants(res.map((participant) => ({
          ...participant,
          user: participant.user ? {
            ...participant.user,
            displayName: participant.user.displayName || participant.user.display_name,
            avatarUrl: participant.user.avatarUrl || participant.user.avatar_url,
          } : null,
        })));
        setParticipantsCount(res.filter((participant) => participant.role === 'viewer' || participant.role === 'host').length);
        setApprovalError(null);
      }
    } catch (e) {
      console.error('Error fetching participants:', e);
      setApprovalError('Access requests could not refresh. Retrying automatically.');
    }
  }, [sessionId]);

  useEffect(() => {
    if (!isHost) return;
    const refreshParticipants = () => {
      if (document.visibilityState === 'visible') fetchParticipants();
    };
    refreshParticipants();
    participantFetchRef.current = setInterval(refreshParticipants, 5000);
    document.addEventListener('visibilitychange', refreshParticipants);
    return () => {
      if (participantFetchRef.current) clearInterval(participantFetchRef.current);
      document.removeEventListener('visibilitychange', refreshParticipants);
    };
  }, [sessionId, isHost, fetchParticipants]);

  const handleApproveParticipant = async (targetUserId: string) => {
    if (!targetUserId || reviewingParticipantId) return;
    setApprovalError(null);
    setReviewingParticipantId(targetUserId);
    try {
      await api.post(`/api/sessions/${sessionId}/approve/${targetUserId}`);
      await fetchParticipants();
    } catch (e) {
      console.error('Error approving user:', e);
      setApprovalError(e instanceof Error ? e.message : 'Unable to approve this access request.');
    } finally {
      setReviewingParticipantId(null);
    }
  };

  const handleRejectParticipant = async (targetUserId: string) => {
    if (!targetUserId || reviewingParticipantId) return;
    setApprovalError(null);
    setReviewingParticipantId(targetUserId);
    try {
      await api.post(`/api/sessions/${sessionId}/reject/${targetUserId}`);
      await fetchParticipants();
    } catch (e) {
      console.error('Error rejecting user:', e);
      setApprovalError(e instanceof Error ? e.message : 'Unable to reject this access request.');
    } finally {
      setReviewingParticipantId(null);
    }
  };

  // ─── WebRTC client — created ONCE per session mount, lives in a ref ──────────
  useEffect(() => {
    if (!userId) return;

    // Tear down any existing client before creating a new one
    if (rtcClientRef.current) {
      rtcClientRef.current.close();
      rtcClientRef.current = null;
    }

    const client = new WebRTCClient({
      sessionId,
      currentUserId: String(userId),
      currentUsername: username,
      presenterId: String(hostId),
      isHost,
      isPresenter: isHost,
      onStream: (stream, presenterInfo) => {
        // Only set remote stream when we are NOT the one sharing
        if (!isSharingRef.current) {
          setActiveStream(stream);
          activeStreamRef.current = stream;
          if (presenterInfo?.username) {
            setRemotePresenterName(presenterInfo.username);
          }
        }
      },
      onPresenterStatusChange: (isLive, presenterName) => {
        if (presenterName) setRemotePresenterName(presenterName);
        if (!isLive && !isSharingRef.current) {
          setActiveStream(null);
          activeStreamRef.current = null;
        }
      },
      // This callback routes outgoing WebRTC signals through the WebSocket.
      // socketRef.current is also a ref — always current.
      onSignal: (signal) => {
        socketRef.current?.send({
          type: 'rtc_signal',
          data: signal,
          target_user_id: signal.target_user_id,
        });
      },
    });

    rtcClientRef.current = client;

    // Announce our presence to all peers already in the room.
    // Both host and viewers send peer_joined so everyone can initiate offers.
    const announceTimer = setTimeout(() => {
      socketRef.current?.send({
        type: 'rtc_signal',
        data: {
          type: 'peer_joined',
          user_id: userId,
          username,
        },
      });
    }, 500);

    return () => {
      clearTimeout(announceTimer);
      if (shareTimerRef.current) clearInterval(shareTimerRef.current);
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
      if (mediaRecorderRef.current?.state === 'recording') mediaRecorderRef.current.stop();
      if (activeStreamRef.current && isSharingRef.current) stopBroadcastTracks(activeStreamRef.current);
      activeStreamRef.current = null;
      isSharingRef.current = false;
      client.close();
      rtcClientRef.current = null;
    };
    // NOTE: isSharingScreen intentionally NOT in deps — that's exactly the bug we're fixing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, isHost, userId]);

  // ─── Screen Share ─────────────────────────────────────────────────────────────
  const handleStartScreenShare = async () => {
    if (capturePendingRef.current || isSharingRef.current) return;
    setBroadcastError(null);
    if (!canControlBroadcast) {
      setBroadcastError('Only the broadcast host can share a screen.');
      return;
    }
    if (!navigator.mediaDevices?.getDisplayMedia) {
      setBroadcastError('Screen sharing is unavailable in this browser. Use a supported desktop browser to present; you can still watch here.');
      return;
    }
    if (socketRef.current?.getState() !== 'CONNECTED' || !rtcClientRef.current) {
      setBroadcastError('Wait for the secure session connection before sharing. If it stays unavailable, reload the room.');
      return;
    }
    const client = rtcClientRef.current;
    capturePendingRef.current = true;
    setIsStartingShare(true);
    let capturedStream: MediaStream | null = null;
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia(broadcastCaptureOptions());
      capturedStream = stream;

      if (rtcClientRef.current !== client) {
        stopBroadcastTracks(stream);
        return;
      }

      // Update refs immediately — callbacks read these, not stale state.
      isSharingRef.current = true;
      activeStreamRef.current = stream;
      setActiveStream(stream);
      setIsSharingScreen(true);
      setHasSharedAudio(stream.getAudioTracks().length > 0);
      setCaptureSurface(stream.getVideoTracks()[0]?.getSettings().displaySurface || null);

      // Push stream into the existing (ref-stable) WebRTC client.
      if (rtcClientRef.current) {
        await rtcClientRef.current.setLocalStream(stream);
      }
      if (rtcClientRef.current !== client || !isSharingRef.current) {
        stopBroadcastTracks(stream);
        return;
      }

      // Start 30-minute share limit timer
      setShareTimeLeft(1800);
      shareTimerRef.current = setInterval(() => {
        setShareTimeLeft((prev) => {
          if (prev === null) return null;
          if (prev <= 1) {
            clearInterval(shareTimerRef.current);
            void handleStopScreenShare();
            alert('Your screen sharing reached the 30-minute session limit and was safely stopped.');
            return null;
          }
          return prev - 1;
        });
      }, 1000);

      // Handle user stopping via the native browser "Stop sharing" bar.
      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.onended = () => { void handleStopScreenShare(); };
      }
    } catch (err: unknown) {
      if (capturedStream) stopBroadcastTracks(capturedStream);
      isSharingRef.current = false;
      activeStreamRef.current = null;
      setActiveStream(null);
      setIsSharingScreen(false);
      setHasSharedAudio(false);
      setCaptureSurface(null);
      console.warn('Display media capture cancelled or rejected:', err);
      setBroadcastError(err instanceof Error && err.name === 'NotAllowedError'
        ? 'Screen sharing was cancelled or denied. Click Share Screen and choose a screen, window, or tab.'
        : 'Unable to capture your screen. Check browser permissions and try again.');
    } finally {
      capturePendingRef.current = false;
      setIsStartingShare(false);
    }
  };

  const handleStopScreenShare = async () => {
    const stream = activeStreamRef.current;
    if (!stream && !isSharingRef.current) return;

    isSharingRef.current = false;
    activeStreamRef.current = null;
    setActiveStream(null);
    setIsSharingScreen(false);
    setHasSharedAudio(false);
    setCaptureSurface(null);
    setShareTimeLeft(null);
    if (mediaRecorderRef.current?.state === 'recording') stopRecording();

    if (shareTimerRef.current) {
      clearInterval(shareTimerRef.current);
      shareTimerRef.current = null;
    }

    // Notify peers before ending tracks, so a delayed track-ended event cannot
    // leave their UI showing an unavailable but still-live presentation.
    if (stream) stopBroadcastTracks(stream);
    if (rtcClientRef.current) await rtcClientRef.current.setLocalStream(null);
  };

  const handleShareToggle = (enabled: boolean) => {
    if (!canControlBroadcast) return;
    if (enabled) void handleStartScreenShare();
    else void handleStopScreenShare();
  };

  // ─── Recording ───────────────────────────────────────────────────────────────
  const startRecording = async () => {
    if (!canControlBroadcast) return;
    try {
      let recordStream: MediaStream;
      if (activeStreamRef.current && activeStreamRef.current.active) {
        recordStream = activeStreamRef.current;
      } else {
        setBroadcastError('Share your screen before starting a recording.');
        return;
      }

      recordedChunksRef.current = [];
      const mimeType = [
        'video/webm;codecs=vp9,opus',
        'video/webm;codecs=vp8,opus',
        'video/webm',
        'video/mp4',
      ].find((t) => typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(t)) || '';

      const recorder = new MediaRecorder(recordStream, mimeType ? { mimeType } : {});
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) recordedChunksRef.current.push(e.data);
      };
      recorder.onstop = () => exportRecording();
      recorder.start(1000);

      mediaRecorderRef.current = recorder;
      setIsRecording(true);
      setRecordingSeconds(0);

      socketRef.current?.send({ type: 'recording_status', data: { isRecording: true, hostName } });
      recordingTimerRef.current = setInterval(() => setRecordingSeconds((p) => p + 1), 1000);
    } catch (err) {
      console.error('Failed to start recording:', err);
      alert('Unable to start recording: permissions denied or no stream available.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    setIsRecording(false);
    socketRef.current?.send({ type: 'recording_status', data: { isRecording: false, hostName } });
  };

  const exportRecording = () => {
    if (!recordedChunksRef.current.length) return;
    const blob = new Blob(recordedChunksRef.current, { type: 'video/webm' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    a.download = `FxZone-Recording-${sessionTitle.replace(/[^a-zA-Z0-9_-]/g, '_')}-${new Date().toISOString().slice(0, 10)}.webm`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 100);
  };

  const handleToggleRecord = () => {
    if (!canControlBroadcast) return;
    if (isRecording) stopRecording();
    else startRecording();
  };

  // ─── Helpers ──────────────────────────────────────────────────────────────────
  const formatRecordTime = (s: number) =>
    `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;

  const formatTime = (s: number) =>
    `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;

  const handleSendChat = (text: string) => {
    if (!user || socketRef.current?.getState() !== 'CONNECTED') return false;
    return socketRef.current.send({
      type: 'chat_message',
      data: {
        id: crypto.randomUUID(),
        userId: user.id,
        username: user.username,
        displayName: user.display_name || user.username,
        avatarUrl: user.avatar_url,
        content: text,
        createdAt: new Date().toISOString(),
      },
    });
  };

  // Audio/video mute toggles — always use the ref.
  const handleMicToggle = (enabled: boolean) => {
    if (canControlBroadcast) rtcClientRef.current?.toggleAudio(enabled);
  };
  const handleCamToggle = (enabled: boolean) => {
    if (canControlBroadcast) rtcClientRef.current?.toggleVideo(enabled);
  };

  const handleEndBroadcast = async () => {
    if (!canEndBroadcast || isEndingBroadcast) return;
    const confirmation = isHost
      ? 'End this live broadcast for every participant?'
      : 'Terminate this live broadcast session? All participants will be disconnected.';
    if (!confirm(confirmation)) return;
    setIsEndingBroadcast(true);
    try {
      await api.post(`/api/sessions/${sessionId}/end`, {});
      onLeave();
    } catch (e) {
      console.error('Live broadcast end failed:', e);
      alert('Failed to end the broadcast. Check your connection and try again.');
    } finally {
      setIsEndingBroadcast(false);
    }
  };

  const pendingParticipants = participants.filter((p) => p.role === 'pending');

  // ─── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="flex-1 min-w-0 flex flex-col select-none">
      {/* Title Bar */}
      <div className="px-4 py-3 border-b border-zinc-850 bg-zinc-950 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold text-white flex items-center gap-2">
            {sessionTitle}
            <span className="text-[9px] bg-red-600/10 border border-red-500/20 text-red-400 font-semibold px-2 py-0.5 rounded-full uppercase tracking-wider flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-ping" />
              Live
            </span>
            {isHost && (
              <span className="text-[9px] border border-blue-400/30 bg-blue-500/10 px-2 py-0.5 font-semibold uppercase tracking-wider text-blue-300 rounded-full">
                Host controls
              </span>
            )}
          </h2>
          <span className="text-[10px] text-zinc-400 block mt-0.5 font-medium">Presenter: {hostName}</span>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-zinc-300">
          <span
            className={`text-[9px] uppercase tracking-wider font-bold px-2.5 py-1 rounded-lg border ${
              signalingStatus === 'connected'
                ? 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20'
                : signalingStatus === 'unavailable'
                  ? 'text-rose-400 bg-rose-500/10 border-rose-500/20'
                  : 'text-amber-400 bg-amber-500/10 border-amber-500/20'
            }`}
            title={signalingStatus === 'unavailable'
              ? 'Secure signaling could not connect. Check your session access and try again.'
              : undefined}
          >
            {signalingStatus === 'connected'
              ? 'Connected'
              : signalingStatus === 'unavailable'
                ? 'Signal unavailable'
                  : 'Connecting…'}
          </span>
          {(isRecording || isRoomBeingRecorded) && (
            <div className="flex items-center gap-1.5 bg-red-500/15 border border-red-500/30 text-red-400 px-2.5 py-1 rounded-lg text-[9px] font-bold uppercase tracking-wider">
              <Disc size={11} className="animate-spin text-red-500" />
              <span>Recording {isRecording ? formatRecordTime(recordingSeconds) : 'Active'}</span>
            </div>
          )}

          {isAdmin && !isHost && (
            <button
              onClick={handleEndBroadcast}
              disabled={isEndingBroadcast}
              className="flex items-center gap-1 text-[9px] bg-rose-600 hover:bg-rose-500 text-white font-bold px-2.5 py-1 rounded-lg transition-colors shadow-lg disabled:cursor-not-allowed disabled:opacity-60"
              title="Cut off live stream (Admin Override)"
            >
              <X size={11} /> End Session (Admin)
            </button>
          )}

          {shareTimeLeft !== null && (
            <div className="flex items-center gap-1.5 text-amber-500 bg-amber-500/15 border border-amber-500/20 px-2.5 py-1 rounded-lg">
              <Clock size={12} className="animate-pulse" />
              <span className="text-[9px] uppercase tracking-wider font-bold">
                Share Limit: {formatTime(shareTimeLeft)}
              </span>
            </div>
          )}

          <div className="flex items-center gap-1.5 bg-zinc-900 border border-zinc-800 px-2.5 py-1 rounded-lg">
            <Users size={13} className="text-blue-400" />
            <span className="text-xs">{participantsCount} {participantsCount === 1 ? 'participant' : 'participants'}</span>
          </div>

          <div className="h-4 w-[1px] bg-zinc-800" />
          <span className="text-[9px] text-emerald-500 flex items-center gap-1 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-lg">
            <Shield size={11} className="fill-emerald-500/10" /> Encrypted WebRTC
          </span>
        </div>
      </div>

      {/* Main Room Split View */}
      <div className="flex-1 flex flex-col xl:flex-row min-h-0 relative">
        {/* Stream Area */}
        <div className="flex-1 p-3 sm:p-5 flex flex-col gap-4 min-w-0">
          {canControlBroadcast && !screenShareSupported && <p role="status" className="rounded-lg border border-blue-500/30 bg-blue-500/10 p-3 text-xs text-blue-200">{screenShareUnavailableMessage(screenShareCapability)}</p>}
          {broadcastError && <p role="alert" className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-500">{broadcastError}</p>}
          {isSharingScreen && captureSurface && (
            <p role="status" className="rounded-lg border border-blue-500/30 bg-blue-500/10 p-3 text-xs text-blue-100">
              {captureSurface === 'monitor'
                ? 'Broadcasting your entire screen. Viewers can follow as you navigate FxZone and other apps.'
                : `Broadcasting one ${captureSurface}. Viewers only see that ${captureSurface}; select Entire Screen when sharing to show your full navigation.`}
            </p>
          )}
          {/* AI Alerts */}
          {copilotAlerts.length > 0 && (
            <div className="bg-yellow-500/10 border border-yellow-500/30 p-2.5 rounded-lg flex items-start gap-2 text-[10px] text-yellow-500 animate-pulse">
              <AlertTriangle size={14} className="shrink-0 mt-0.5" />
              <div>
                <span className="font-bold block uppercase tracking-wider text-[8px]">Google AI Stream Alert</span>
                <p className="font-medium text-zinc-200 mt-0.5">{copilotAlerts[0]}</p>
              </div>
            </div>
          )}

          {/* Screen Share Component */}
          <div className="flex-1 min-h-64 h-[45dvh] xl:h-auto">
            <ScreenShare
              stream={activeStream}
              presenterName={
                isSharingScreen
                  ? 'You (Sharing Screen)'
                  : (remotePresenterName ? `@${remotePresenterName}` : hostName)
              }
              isLocal={isSharingScreen}
              isHost={isHost}
            />
          </div>

          {/* Controls Bar */}
          <SessionControls
            isHost={canControlBroadcast}
            isSharing={isSharingScreen}
            isStartingShare={isStartingShare}
            canStartShare={signalingStatus === 'connected'}
            screenShareSupported={screenShareSupported}
            hasSharedAudio={hasSharedAudio}
            isRecording={isRecording}
            recordingDuration={formatRecordTime(recordingSeconds)}
            onToggleMic={handleMicToggle}
            onToggleCamera={handleCamToggle}
            onToggleShare={handleShareToggle}
            onToggleRecord={canControlBroadcast ? handleToggleRecord : undefined}
            onEndBroadcast={isHost ? handleEndBroadcast : undefined}
            isEndingBroadcast={isEndingBroadcast}
            onLeave={() => {
              if (isRecording) stopRecording();
              onLeave();
            }}
          />
        </div>

        {/* Host Participant Approval Sidebar */}
        {isHost && (
          <div className="w-full xl:w-72 xl:shrink-0 border-t xl:border-t-0 xl:border-l border-zinc-850 bg-zinc-950 p-4 flex flex-col gap-3">
            <div className="flex items-center gap-1.5 pb-2 border-b border-zinc-850">
              <Users size={14} className="text-purple-400 animate-pulse" />
              <h3 className="text-xs font-semibold text-zinc-300" aria-live="polite">
                Access Requests ({pendingParticipants.length})
              </h3>
            </div>
            {pendingParticipants.length === 0 && <p className="text-sm text-zinc-400">No requests yet. Followers can request to join this room; you choose who enters.</p>}
            {approvalError && (
              <p role="alert" className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-2 text-[10px] leading-relaxed text-rose-300">
                {approvalError}
              </p>
            )}
            <div className="flex-1 max-h-72 xl:max-h-none overflow-y-auto space-y-2 pr-1">
              {pendingParticipants.map((p) => {
                const targetUserId = String(p.user_id || p.userId || p.user?.id);
                return (
                  <div
                    key={p.id}
                    className="p-2.5 bg-zinc-900 border border-zinc-850 rounded-xl flex items-center justify-between gap-2 transition-all hover:bg-zinc-850/50"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <Avatar
                        name={p.user?.displayName || p.user?.username || 'Trader'}
                        src={p.user?.avatarUrl}
                        size="sm"
                      />
                      <div className="min-w-0">
                        <span className="text-[10px] font-bold text-white block truncate leading-tight">
                          {p.user?.displayName || p.user?.username}
                        </span>
                        <span className="text-[8px] text-zinc-550 block">@{p.user?.username}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        size="sm"
                        className="min-h-10 px-2 text-xs bg-emerald-600 hover:bg-emerald-500 font-semibold rounded-lg flex items-center gap-1"
                        onClick={() => handleApproveParticipant(targetUserId)}
                        title="Approve access"
                        disabled={Boolean(reviewingParticipantId)}
                      >
                        {reviewingParticipantId === targetUserId ? 'Working…' : <><Check size={10} /> Approve</>}
                      </Button>
                      <button
                        className="h-10 w-10 flex items-center justify-center rounded-lg bg-zinc-800 hover:bg-rose-600/80 text-zinc-400 hover:text-white transition-colors"
                        aria-label={`Decline ${p.user?.displayName || p.user?.username || 'user'}'s request`}
                        onClick={() => handleRejectParticipant(targetUserId)}
                        title="Reject request"
                        disabled={Boolean(reviewingParticipantId)}
                      >
                        <X size={10} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Embedded Live Chat Sidebar */}
        <SessionChat
          messages={chatMessages}
          onSendMessage={handleSendChat}
          currentUserId={user?.id || ''}
          connected={signalingStatus === 'connected'}
        />
      </div>
    </div>
  );
}
