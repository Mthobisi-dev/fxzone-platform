'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ScreenShare } from './ScreenShare';
import { SessionChat, SessionChatMessage } from './SessionChat';
import { SessionControls } from './SessionControls';
import { useAuth } from '@/hooks/useAuth';
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
import { api } from '@/lib/api';
import { Button } from '../ui/Button';
import { Avatar } from '../ui/Avatar';

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
  const { user } = useAuth();

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
  const isAdmin = !!(
    user &&
    (user.role === 'admin' ||
      (user.role as any)?.value === 'admin' ||
      user.username === 'admin' ||
      user.email === 'admin@fxzone.io')
  );

  // ─── WebSocket ────────────────────────────────────────────────────────────────
  // IMPORTANT: rtc_signal handler reads from rtcClientRef (not stale state).
  const socketRef = useWebSocket(`/ws/session/${sessionId}`, {
    chat_message: (payload) => {
      const msg = payload.data as SessionChatMessage;
      setChatMessages((prev) => [...prev, msg]);
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
          data: { type: 'presenter_stream_started', active: true },
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
  });

  // ─── Participants ─────────────────────────────────────────────────────────────
  const fetchParticipants = useCallback(async () => {
    try {
      const res = await api.get(`/api/sessions/${sessionId}/participants`);
      if (Array.isArray(res)) setParticipants(res);
    } catch (e) {
      console.error('Error fetching participants:', e);
    }
  }, [sessionId]);

  useEffect(() => {
    fetchParticipants();
    if (isHost) {
      participantFetchRef.current = setInterval(fetchParticipants, 3500);
    }
    return () => {
      if (participantFetchRef.current) clearInterval(participantFetchRef.current);
    };
  }, [sessionId, isHost, fetchParticipants]);

  const handleApproveParticipant = async (targetUserId: string) => {
    try {
      await api.post(`/api/sessions/${sessionId}/approve/${targetUserId}`);
      await fetchParticipants();
    } catch (e) {
      console.error('Error approving user:', e);
    }
  };

  const handleRejectParticipant = async (targetUserId: string) => {
    try {
      await api.post(`/api/sessions/${sessionId}/reject/${targetUserId}`);
      await fetchParticipants();
    } catch (e) {
      console.error('Error rejecting user:', e);
    }
  };

  // ─── WebRTC client — created ONCE per session mount, lives in a ref ──────────
  useEffect(() => {
    if (!user) return;

    // Tear down any existing client before creating a new one
    if (rtcClientRef.current) {
      rtcClientRef.current.close();
      rtcClientRef.current = null;
    }

    const client = new WebRTCClient({
      sessionId,
      currentUserId: String(user.id),
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
          user_id: user.id,
          username: user.username,
        },
      });
    }, 500);

    return () => {
      clearTimeout(announceTimer);
      client.close();
      rtcClientRef.current = null;
    };
    // NOTE: isSharingScreen intentionally NOT in deps — that's exactly the bug we're fixing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, isHost, user]);

  // ─── Screen Share ─────────────────────────────────────────────────────────────
  const handleStartScreenShare = async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          cursor: 'always',
          displaySurface: 'monitor',
          frameRate: { ideal: 30, max: 60 },
        } as any,
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      // Update refs immediately — callbacks read these, not stale state.
      isSharingRef.current = true;
      activeStreamRef.current = stream;
      setActiveStream(stream);
      setIsSharingScreen(true);

      // Push stream into the existing (ref-stable) WebRTC client.
      if (rtcClientRef.current) {
        await rtcClientRef.current.setLocalStream(stream);
      }

      // Start 30-minute share limit timer
      setShareTimeLeft(1800);
      shareTimerRef.current = setInterval(() => {
        setShareTimeLeft((prev) => {
          if (prev === null) return null;
          if (prev <= 1) {
            clearInterval(shareTimerRef.current);
            handleStopScreenShare();
            alert('Your screen sharing reached the 30-minute session limit and was safely stopped.');
            return null;
          }
          return prev - 1;
        });
      }, 1000);

      // Handle user stopping via the native browser "Stop sharing" bar.
      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.onended = () => handleStopScreenShare();
      }
    } catch (err: any) {
      console.warn('Display media capture cancelled or rejected:', err);
    }
  };

  const handleStopScreenShare = () => {
    // Stop all tracks
    if (activeStreamRef.current) {
      activeStreamRef.current.getTracks().forEach((track) => track.stop());
    }

    isSharingRef.current = false;
    activeStreamRef.current = null;
    setActiveStream(null);
    setIsSharingScreen(false);
    setShareTimeLeft(null);

    if (shareTimerRef.current) {
      clearInterval(shareTimerRef.current);
      shareTimerRef.current = null;
    }

    // Notify all peers the stream stopped
    if (rtcClientRef.current) {
      rtcClientRef.current.setLocalStream(null);
    }
  };

  const handleShareToggle = (enabled: boolean) => {
    if (enabled) handleStartScreenShare();
    else handleStopScreenShare();
  };

  // ─── Recording ───────────────────────────────────────────────────────────────
  const startRecording = async () => {
    try {
      let recordStream: MediaStream;
      if (activeStreamRef.current && activeStreamRef.current.active) {
        recordStream = activeStreamRef.current;
      } else {
        recordStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
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
    if (isRecording) stopRecording();
    else startRecording();
  };

  // ─── Helpers ──────────────────────────────────────────────────────────────────
  const formatRecordTime = (s: number) =>
    `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;

  const formatTime = (s: number) =>
    `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;

  const handleSendChat = (text: string) => {
    if (!user) return;
    socketRef.current?.send({
      type: 'chat_message',
      data: {
        id: Math.random().toString(),
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
  const handleMicToggle = (enabled: boolean) => rtcClientRef.current?.toggleAudio(enabled);
  const handleCamToggle = (enabled: boolean) => rtcClientRef.current?.toggleVideo(enabled);

  const handleEndSessionAdmin = async () => {
    if (!isAdmin) return;
    if (!confirm('Terminate this live broadcast session? All participants will be disconnected.')) return;
    try {
      await api.post(`/api/sessions/${sessionId}/end`, {});
      onLeave();
    } catch (e) {
      console.error('Admin cutoff failed:', e);
      alert('Failed to end session. Verify administrator permissions.');
    }
  };

  const pendingParticipants = participants.filter((p) => p.role === 'pending');

  // ─── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="flex-1 h-full flex flex-col justify-between select-none">
      {/* Title Bar */}
      <div className="h-14 px-6 border-b border-zinc-850 bg-zinc-950 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-bold text-white flex items-center gap-2">
            {sessionTitle}
            <span className="text-[9px] bg-red-600/10 border border-red-500/20 text-red-400 font-semibold px-2 py-0.5 rounded-full uppercase tracking-wider flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-ping" />
              Live
            </span>
          </h2>
          <span className="text-[10px] text-zinc-400 block mt-0.5 font-medium">Presenter: {hostName}</span>
        </div>

        <div className="flex items-center gap-3 text-xs font-semibold text-zinc-300">
          {(isRecording || isRoomBeingRecorded) && (
            <div className="flex items-center gap-1.5 bg-red-500/15 border border-red-500/30 text-red-400 px-2.5 py-1 rounded-lg text-[9px] font-bold uppercase tracking-wider">
              <Disc size={11} className="animate-spin text-red-500" />
              <span>Recording {isRecording ? formatRecordTime(recordingSeconds) : 'Active'}</span>
            </div>
          )}

          {isAdmin && (
            <button
              onClick={handleEndSessionAdmin}
              className="flex items-center gap-1 text-[9px] bg-rose-600 hover:bg-rose-500 text-white font-bold px-2.5 py-1 rounded-lg transition-colors shadow-lg"
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
            <span className="text-[10px]">{participantsCount} {participantsCount === 1 ? 'viewer' : 'viewers'}</span>
          </div>

          <div className="h-4 w-[1px] bg-zinc-800" />
          <span className="text-[9px] text-emerald-500 flex items-center gap-1 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-lg">
            <Shield size={11} className="fill-emerald-500/10" /> Encrypted WebRTC
          </span>
        </div>
      </div>

      {/* Main Room Split View */}
      <div className="flex-1 flex min-h-0 relative">
        {/* Stream Area */}
        <div className="flex-1 p-6 flex flex-col gap-4 min-w-0">
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
          <div className="flex-1 min-h-0">
            <ScreenShare
              stream={activeStream}
              presenterName={
                isSharingScreen
                  ? 'You (Sharing Screen)'
                  : (remotePresenterName ? `@${remotePresenterName}` : hostName)
              }
              isLocal={isSharingScreen}
            />
          </div>

          {/* Controls Bar */}
          <SessionControls
            isHost={isHost}
            isSharing={isSharingScreen}
            isRecording={isRecording}
            recordingDuration={formatRecordTime(recordingSeconds)}
            onToggleMic={handleMicToggle}
            onToggleCamera={handleCamToggle}
            onToggleShare={handleShareToggle}
            onToggleRecord={handleToggleRecord}
            onLeave={() => {
              if (isRecording) stopRecording();
              onLeave();
            }}
          />
        </div>

        {/* Host Participant Approval Sidebar */}
        {isHost && pendingParticipants.length > 0 && (
          <div className="w-72 border-l border-zinc-850 bg-zinc-950 p-4 flex flex-col gap-3">
            <div className="flex items-center gap-1.5 pb-2 border-b border-zinc-850">
              <Users size={14} className="text-purple-400 animate-pulse" />
              <h3 className="text-[10px] font-bold text-zinc-300 uppercase tracking-widest">
                Access Requests ({pendingParticipants.length})
              </h3>
            </div>
            <div className="flex-1 overflow-y-auto space-y-2 pr-1 no-scrollbar">
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
                        className="h-6 px-2 text-[9px] bg-emerald-600 hover:bg-emerald-500 font-bold rounded-lg flex items-center gap-0.5"
                        onClick={() => handleApproveParticipant(targetUserId)}
                        title="Approve access"
                      >
                        <Check size={10} /> Approve
                      </Button>
                      <button
                        className="h-6 w-6 flex items-center justify-center rounded-lg bg-zinc-800 hover:bg-rose-600/80 text-zinc-400 hover:text-white transition-colors"
                        onClick={() => handleRejectParticipant(targetUserId)}
                        title="Reject request"
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
        />
      </div>
    </div>
  );
}
