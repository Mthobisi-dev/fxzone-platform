'use client';

import React, { useState, useEffect } from 'react';
import { ScreenShare } from './ScreenShare';
import { SessionChat, SessionChatMessage } from './SessionChat';
import { SessionControls } from './SessionControls';
import { useAuth } from '@/hooks/useAuth';
import { useWebSocket } from '@/hooks/useWebSocket';
import { Shield, Eye, Users, AlertTriangle, Check, X, Clock } from 'lucide-react';
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
  const [chatMessages, setChatMessages] = useState<SessionChatMessage[]>([]);
  const [rtcClient, setRtcClient] = useState<WebRTCClient | null>(null);
  const [copilotAlerts, setCopilotAlerts] = useState<string[]>([]);
  
  // Custom Live Session states
  const [participants, setParticipants] = useState<any[]>([]);
  const [shareTimeLeft, setShareTimeLeft] = useState<number | null>(null);

  // WebSocket signaling channel
  const socketRef = useWebSocket(`/ws/session/${sessionId}`, {
    chat_message: (payload) => {
      const msg = payload.data as SessionChatMessage;
      setChatMessages((prev) => [...prev, msg]);
    },
    rtc_signal: (payload) => {
      rtcClient?.handleSignal(payload.data);
    },
    members_update: (payload) => {
      setParticipantsCount(payload.data.count || 1);
    },
    ai_copilot_alert: (payload) => {
      setCopilotAlerts((prev) => [payload.data.message, ...prev].slice(0, 3));
    }
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
      interval = setInterval(fetchParticipants, 4000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [sessionId, isHost]);

  // Host approves a pending participant
  const handleApproveParticipant = async (targetUserId: string) => {
    try {
      await api.post(`/api/sessions/${sessionId}/approve/${targetUserId}`);
      // Notify participant list
      fetchParticipants();
    } catch (e) {
      console.error('Error approving user:', e);
    }
  };

  const startScreenShare = async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { cursor: "always" } as any,
        audio: true,
      });
      
      setActiveStream(stream);
      if (rtcClient) {
        rtcClient.setLocalStream(stream);
      }

      // Handle user manually stopping screen share via browser bar
      stream.getVideoTracks()[0].onended = () => {
        setActiveStream(null);
      };
    } catch (err: any) {
      console.warn('Display media capture cancelled or rejected:', err);
      // Fallback to user camera if screen capture was rejected
      try {
        const camStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        setActiveStream(camStream);
        if (rtcClient) {
          rtcClient.setLocalStream(camStream);
        }
      } catch (camErr) {
        console.error('Camera fallback failed:', camErr);
      }
    }
  };

  // Initialize WebRTC signaling & streams
  useEffect(() => {
    if (!user) return;
    
    const client = new WebRTCClient({
      isHost,
      onStream: (stream) => {
        // Only set remote streams to prevent screen duplication for host
        if (!isHost) {
          setActiveStream(stream);
        }
      },
      onSignal: (signal) => {
        socketRef.current?.send({ type: 'rtc_signal', data: signal });
      },
    });

    setRtcClient(client);

    return () => {
      client.close();
      if (activeStream) {
        activeStream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [sessionId, isHost, user]);

  // Screen share 30-minute limit (1800 seconds)
  useEffect(() => {
    let interval: any;
    if (activeStream && isHost) {
      setShareTimeLeft(1800);
      interval = setInterval(() => {
        setShareTimeLeft((prev) => {
          if (prev === null) return null;
          if (prev <= 1) {
            clearInterval(interval);
            // Stop stream track
            if (activeStream) {
              activeStream.getTracks().forEach((track) => track.stop());
            }
            setActiveStream(null);
            rtcClient?.setLocalStream(null);
            alert('Your screen sharing has reached the 30-minute session limit and was automatically stopped.');
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
  }, [activeStream, isHost]);

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

  const handleShareToggle = (enabled: boolean) => {
    if (enabled && isHost) {
      startScreenShare();
    } else if (isHost) {
      if (activeStream) {
        activeStream.getTracks().forEach((track) => track.stop());
      }
      setActiveStream(null);
      rtcClient?.setLocalStream(null);
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
            <span className="text-[9px] bg-red-600/10 border border-red-500/20 text-red-400 font-semibold px-2 py-0.5 rounded-full uppercase tracking-wider">
              Live
            </span>
          </h2>
          <span className="text-[10px] text-zinc-400 block mt-0.5 font-medium">Presenter: {hostName}</span>
        </div>

        <div className="flex items-center gap-4 text-xs font-semibold text-zinc-300">
          {shareTimeLeft !== null && (
            <div className="flex items-center gap-1.5 text-amber-500 bg-amber-500/15 border border-amber-500/20 px-2.5 py-1 rounded-lg">
              <Clock size={12} className="animate-pulse" />
              <span className="text-[9px] uppercase tracking-wider font-bold">Screen Share Limit: {formatTime(shareTimeLeft)}</span>
            </div>
          )}
          <div className="flex items-center gap-1">
            <Users size={14} className="text-blue-400" />
            <span>{participantsCount} participants</span>
          </div>
          <div className="h-4 w-[1px] bg-zinc-800" />
          <span className="text-[9px] text-emerald-500 flex items-center gap-1 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-lg">
            <Shield size={11} className="fill-emerald-500/10" /> Protected signaling
          </span>
        </div>
      </div>

      {/* Main Room Split View */}
      <div className="flex-1 flex min-h-0 relative">
        {/* Stream Area */}
        <div className="flex-1 p-6 flex flex-col gap-4 min-w-0">
          {/* Google AI Alerts Display */}
          {copilotAlerts.length > 0 && (
            <div className="bg-yellow-500/10 border border-yellow-500/30 p-2.5 rounded-lg flex items-start gap-2 text-[10px] text-yellow-500 animate-pulse">
              <AlertTriangle size={14} className="shrink-0 mt-0.5" />
              <div>
                <span className="font-bold block uppercase tracking-wider text-[8px]">Google AI Stream Alert</span>
                <p className="font-medium text-zinc-200 mt-0.5">{copilotAlerts[0]}</p>
              </div>
            </div>
          )}

          {/* Screen Share Screen */}
          <div className="flex-1 min-h-0">
            <ScreenShare stream={activeStream} presenterName={hostName} isLocal={isHost} />
          </div>
          
          {/* Controls Bar */}
          <SessionControls
            isHost={isHost}
            onToggleMic={handleMicToggle}
            onToggleCamera={handleCamToggle}
            onToggleShare={handleShareToggle}
            onLeave={onLeave}
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
              {pendingParticipants.map((p) => (
                <div key={p.id} className="p-2.5 bg-zinc-900 border border-zinc-850 rounded-xl flex items-center justify-between gap-2 transition-all hover:bg-zinc-850/50">
                  <div className="flex items-center gap-2 min-w-0">
                    <Avatar name={p.user.displayName || p.user.username} src={p.user.avatarUrl} size="sm" />
                    <div className="min-w-0">
                      <span className="text-[10px] font-bold text-white block truncate leading-tight">
                        {p.user.displayName || p.user.username}
                      </span>
                      <span className="text-[8px] text-zinc-550 block">@{p.user.username}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      size="sm"
                      className="h-6 px-2 text-[9px] bg-emerald-600 hover:bg-emerald-500 font-bold rounded-lg flex items-center gap-0.5"
                      onClick={() => handleApproveParticipant(p.user_id)}
                      title="Approve access"
                    >
                      <Check size={10} /> Approve
                    </Button>
                    <button
                      className="h-6 w-6 flex items-center justify-center rounded-lg bg-zinc-800 hover:bg-rose-600/80 text-zinc-400 hover:text-white transition-colors"
                      onClick={async () => {
                        try {
                          await api.post(`/api/sessions/${sessionId}/reject/${p.user_id}`);
                          fetchParticipants();
                        } catch (e) {
                          console.error(e);
                        }
                      }}
                      title="Reject request"
                    >
                      <X size={10} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Embedded Chat sidebar */}
        <SessionChat
          messages={chatMessages}
          onSendMessage={handleSendChat}
          currentUserId={user?.id || ''}
        />
      </div>
    </div>
  );
}
