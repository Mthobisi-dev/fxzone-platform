'use client';

import React, { useState, useEffect, useRef } from 'react';
import { ScreenShare } from './ScreenShare';
import { SessionChat, SessionChatMessage } from './SessionChat';
import { SessionControls } from './SessionControls';
import { useAuth } from '@/hooks/useAuth';
import { useWebSocket } from '@/hooks/useWebSocket';
import {
  Shield,
  Eye,
  Users,
  AlertTriangle,
  Check,
  X,
  Clock,
  Disc,
  Download,
  Radio,
  CheckCircle2,
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
  const [participantsCount, setParticipantsCount] = useState(1);
  const [activeStream, setActiveStream] = useState<MediaStream | null>(null);
  const [isSharingScreen, setIsSharingScreen] = useState(false);
  const [remotePresenterName, setRemotePresenterName] = useState<string>('');
  const [chatMessages, setChatMessages] = useState<SessionChatMessage[]>([]);
  const [rtcClient, setRtcClient] = useState<WebRTCClient | null>(null);
  const [copilotAlerts, setCopilotAlerts] = useState<string[]>([]);

  // Participants and Approval State
  const [participants, setParticipants] = useState<any[]>([]);
  const [shareTimeLeft, setShareTimeLeft] = useState<number | null>(null);

  // Live Recording state
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [isRoomBeingRecorded, setIsRoomBeingRecorded] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<any>(null);

  // Admin override detection
  const isAdmin = !!(
    user &&
    (user.role === 'admin' ||
      (user.role as any)?.value === 'admin' ||
      user.username === 'admin' ||
      user.email === 'admin@fxzone.io')
  );

  // WebSocket signaling channel
  const socketRef = useWebSocket(`/ws/session/${sessionId}`, {
    chat_message: (payload) => {
      const msg = payload.data as SessionChatMessage;
      setChatMessages((prev) => [...prev, msg]);
    },
    rtc_signal: (payload) => {
      rtcClient?.handleSignal(payload.data || payload);
    },
    members_update: (payload) => {
      setParticipantsCount(payload.data?.count || payload.count || 1);
    },
    participant_approved: (payload) => {
      fetchParticipants();
      // If presenting an active stream, announce stream presence
      if (activeStream && rtcClient) {
        socketRef.current?.send({
          type: 'rtc_signal',
          data: { type: 'presenter_stream_started', active: true, presenter_id: user?.id },
        });
      }
    },
    participant_rejected: (payload) => {
      fetchParticipants();
    },
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

  // Fetch participants (active + pending)
  const fetchParticipants = async () => {
    try {
      const res = await api.get(`/api/sessions/${sessionId}/participants`);
      if (Array.isArray(res)) {
        setParticipants(res);
      }
    } catch (e) {
      console.error('Error fetching participants:', e);
    }
  };

  useEffect(() => {
    fetchParticipants();
    let interval: any;
    if (isHost) {
      interval = setInterval(fetchParticipants, 3500);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [sessionId, isHost]);

  // Host approves a pending participant
  const handleApproveParticipant = async (targetUserId: string) => {
    try {
      await api.post(`/api/sessions/${sessionId}/approve/${targetUserId}`);
      await fetchParticipants();
    } catch (e) {
      console.error('Error approving user:', e);
    }
  };

  // Host rejects a pending participant
  const handleRejectParticipant = async (targetUserId: string) => {
    try {
      await api.post(`/api/sessions/${sessionId}/reject/${targetUserId}`);
      await fetchParticipants();
    } catch (e) {
      console.error('Error rejecting user:', e);
    }
  };

  // Initialize WebRTC client
  useEffect(() => {
    if (!user) return;

    const client = new WebRTCClient({
      sessionId,
      currentUserId: String(user.id),
      isHost,
      isPresenter: isHost,
      onStream: (stream, presenterInfo) => {
        if (!isSharingScreen) {
          setActiveStream(stream);
          if (presenterInfo?.username) {
            setRemotePresenterName(presenterInfo.username);
          }
        }
      },
      onPresenterStatusChange: (isLive, presenterName) => {
        if (presenterName) {
          setRemotePresenterName(presenterName);
        }
        if (!isLive && !isSharingScreen) {
          setActiveStream(null);
        }
      },
      onSignal: (signal) => {
        socketRef.current?.send({
          type: 'rtc_signal',
          data: signal,
          target_user_id: signal.target_user_id,
        });
      },
    });

    setRtcClient(client);

    // Announce presence to room peers
    setTimeout(() => {
      socketRef.current?.send({
        type: 'rtc_signal',
        data: {
          type: 'peer_joined',
          user_id: user.id,
          username: user.username,
        },
      });
    }, 400);

    return () => {
      client.close();
    };
  }, [sessionId, isHost, user, isSharingScreen]);

  // Start Screen Share
  const handleStartScreenShare = async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          cursor: 'always',
          displaySurface: 'monitor',
          frameRate: { ideal: 30, max: 60 },
          width: { ideal: 1920, max: 2560 },
          height: { ideal: 1080, max: 1440 },
        } as any,
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      setActiveStream(stream);
      setIsSharingScreen(true);

      if (rtcClient) {
        await rtcClient.setLocalStream(stream);
      }

      // Handle user stopping screen share via native browser bar
      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.onended = () => {
          handleStopScreenShare();
        };
      }
    } catch (err: any) {
      console.warn('Display media capture cancelled or rejected:', err);
    }
  };

  // Stop Screen Share
  const handleStopScreenShare = () => {
    if (activeStream) {
      activeStream.getTracks().forEach((track) => track.stop());
    }
    setActiveStream(null);
    setIsSharingScreen(false);
    if (rtcClient) {
      rtcClient.setLocalStream(null);
    }
  };

  const handleShareToggle = (enabled: boolean) => {
    if (enabled) {
      handleStartScreenShare();
    } else {
      handleStopScreenShare();
    }
  };

  // Screen share 30-minute limit (1800 seconds)
  useEffect(() => {
    let interval: any;
    if (isSharingScreen && isHost) {
      setShareTimeLeft(1800);
      interval = setInterval(() => {
        setShareTimeLeft((prev) => {
          if (prev === null) return null;
          if (prev <= 1) {
            clearInterval(interval);
            handleStopScreenShare();
            alert('Your screen sharing reached the 30-minute session limit and was safely stopped.');
            return null;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      setShareTimeLeft(null);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isSharingScreen, isHost]);

  // ============================================================
  // Session Recording Feature (MediaRecorder API)
  // ============================================================
  const startRecording = async () => {
    try {
      let recordStream: MediaStream;

      if (activeStream && activeStream.active) {
        // Use active screen share / camera stream
        recordStream = activeStream;
      } else {
        // Capture screen or audio for recording
        recordStream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
          audio: true,
        });
      }

      recordedChunksRef.current = [];

      // Determine supported MIME type
      const mimeType = [
        'video/webm;codecs=vp9,opus',
        'video/webm;codecs=vp8,opus',
        'video/webm',
        'video/mp4',
      ].find((type) => typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(type)) || '';

      const options = mimeType ? { mimeType } : {};
      const recorder = new MediaRecorder(recordStream, options);

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        exportRecording();
      };

      recorder.start(1000); // 1-second timeslices
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
      setRecordingSeconds(0);

      // Notify WebSocket channel that recording started
      socketRef.current?.send({
        type: 'recording_status',
        data: { isRecording: true, hostName },
      });

      // Start duration timer
      recordingTimerRef.current = setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      console.error('Failed to start session recording:', err);
      alert('Unable to start recording: permissions were denied or no stream was available.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
    }
    setIsRecording(false);

    // Notify WebSocket channel that recording stopped
    socketRef.current?.send({
      type: 'recording_status',
      data: { isRecording: false, hostName },
    });
  };

  const exportRecording = () => {
    if (recordedChunksRef.current.length === 0) return;

    const blob = new Blob(recordedChunksRef.current, { type: 'video/webm' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    const sanitizedTitle = sessionTitle.replace(/[^a-zA-Z0-9_-]/g, '_');
    a.download = `FxZone-Recording-${sanitizedTitle}-${new Date().toISOString().slice(0, 10)}.webm`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 100);
  };

  const handleToggleRecord = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  // Format recording timer seconds to MM:SS
  const formatRecordTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60).toString().padStart(2, '0');
    const secs = (seconds % 60).toString().padStart(2, '0');
    return `${mins}:${secs}`;
  };

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

  const handleMicToggle = (enabled: boolean) => {
    rtcClient?.toggleAudio(enabled);
  };

  const handleCamToggle = (enabled: boolean) => {
    rtcClient?.toggleVideo(enabled);
  };

  // Admin hard cutoff
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

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const pendingParticipants = participants.filter((p) => p.role === 'pending');

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
          {/* Room Recording Status Banner */}
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

          {/* Interactive Controls Bar with Screen Share and Recording */}
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
              if (isRecording) {
                stopRecording();
              }
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
