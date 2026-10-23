'use client';

import React, { useState, useEffect } from 'react';
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  ScreenShare,
  ScreenShareOff,
  PhoneOff,
  Radio,
  Square,
  Disc,
} from 'lucide-react';
import { Button } from '../ui/Button';

interface SessionControlsProps {
  isHost: boolean;
  isSharing: boolean;
  isStartingShare?: boolean;
  canStartShare?: boolean;
  screenShareSupported?: boolean;
  hasSharedAudio?: boolean;
  hasMicrophone?: boolean;
  isRecording?: boolean;
  recordingDuration?: string;
  onToggleMic: (enabled: boolean) => void;
  onToggleCamera: (enabled: boolean) => void;
  onToggleShare: (enabled: boolean) => void;
  onToggleRecord?: () => void;
  onEndBroadcast?: () => void;
  isEndingBroadcast?: boolean;
  onLeave: () => void;
  startTime?: string | Date;
}

export function SessionControls({
  isHost,
  isSharing,
  isStartingShare = false,
  canStartShare = true,
  screenShareSupported = true,
  hasSharedAudio = false,
  hasMicrophone,
  isRecording = false,
  recordingDuration = '00:00',
  onToggleMic,
  onToggleCamera,
  onToggleShare,
  onToggleRecord,
  onEndBroadcast,
  isEndingBroadcast = false,
  onLeave,
  startTime,
}: SessionControlsProps) {
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [duration, setDuration] = useState('00:00:00');
  const [mountedAt] = useState(() => Date.now());
  const microphoneAvailable = hasMicrophone ?? hasSharedAudio;

  useEffect(() => {
    const start = startTime ? new Date(startTime).getTime() : mountedAt;

    const interval = setInterval(() => {
      const diff = Math.max(0, Date.now() - start);
      const hrs = Math.floor(diff / 3600000).toString().padStart(2, '0');
      const mins = Math.floor((diff % 3600000) / 60000).toString().padStart(2, '0');
      const secs = Math.floor((diff % 60000) / 1000).toString().padStart(2, '0');
      setDuration(`${hrs}:${mins}:${secs}`);
    }, 1000);

    return () => clearInterval(interval);
  }, [startTime, mountedAt]);

  const handleMic = () => {
    const val = !micOn;
    setMicOn(val);
    onToggleMic(val);
  };

  const handleCam = () => {
    const val = !camOn;
    setCamOn(val);
    onToggleCamera(val);
  };

  const handleShare = () => {
    if (!isSharing) { setMicOn(true); setCamOn(true); }
    onToggleShare(!isSharing);
  };

  return (
    <div className="relative flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--fx-border-subtle)] bg-[var(--fx-bg-surface)] px-3 py-3">
      {/* Session Timer & Recording Badge */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 bg-zinc-900/80 border border-zinc-800 px-3 py-1.5 rounded-lg">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
          </span>
          <span className="text-xs font-mono font-bold text-zinc-300">{duration}</span>
        </div>

        {/* Live Recording State Indicator */}
        {isRecording && (
          <div className="flex items-center gap-1.5 bg-red-600/15 border border-red-500/30 text-red-400 px-2.5 py-1.5 rounded-lg text-[10px] font-bold font-mono animate-pulse">
            <Disc size={13} className="animate-spin text-red-500" />
            <span>REC {recordingDuration}</span>
          </div>
        )}
      </div>

      {/* Interactive Controls */}
      <div className="flex flex-wrap items-center gap-2">
        {isHost && (
          <>
            <button
              onClick={handleMic}
              disabled={!isSharing || !microphoneAvailable}
              className={`min-h-11 min-w-11 rounded-lg border p-2.5 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--fx-accent)] ${
                micOn
                  ? 'bg-zinc-900 border-zinc-800 text-zinc-200 hover:bg-zinc-850'
                  : 'bg-rose-500/10 border-rose-500/30 text-rose-400 hover:bg-rose-500/20'
              }`}
              title={!microphoneAvailable ? 'Microphone unavailable. Allow microphone access when starting the broadcast.' : micOn ? 'Mute microphone' : 'Unmute microphone'}
              aria-label={micOn ? 'Mute microphone' : 'Unmute microphone'}
            >
              {micOn ? <Mic size={15} /> : <MicOff size={15} />}
            </button>

            <button
              onClick={handleCam}
              disabled={!isSharing}
              className={`min-h-11 min-w-11 rounded-lg border p-2.5 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--fx-accent)] ${
                camOn
                  ? 'bg-blue-600/20 border-blue-500/40 text-blue-400 hover:bg-blue-600/30'
                  : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:bg-zinc-850 hover:text-white'
              }`}
              title={camOn ? 'Pause shared video' : 'Resume shared video'}
              aria-label={camOn ? 'Pause shared video' : 'Resume shared video'}
            >
              {camOn ? <Video size={15} /> : <VideoOff size={15} />}
            </button>

            <button
              onClick={handleShare}
              disabled={isStartingShare || (!isSharing && (!canStartShare || !screenShareSupported))}
              className={`flex min-h-11 items-center gap-1.5 rounded-lg border p-2.5 text-xs font-bold transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--fx-accent)] ${
                isSharing
                  ? 'bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-600/30 animate-pulse'
                  : 'bg-zinc-900 border-zinc-800 text-zinc-300 hover:bg-zinc-850 hover:text-white'
              }`}
              title={isSharing ? 'Stop screen sharing' : !screenShareSupported ? 'This browser cannot share a device screen' : 'Share screen with the room'}
            >
              {isSharing ? <ScreenShareOff size={15} /> : <ScreenShare size={15} />}
              <span>{isStartingShare ? 'Choose a screen…' : isSharing ? 'Stop sharing' : !canStartShare ? 'Connecting…' : 'Share screen'}</span>
            </button>

            {onToggleRecord && (
              <button
                onClick={onToggleRecord}
                disabled={!isSharing && !isRecording}
                className={`flex min-h-11 items-center gap-1.5 rounded-lg border p-2.5 text-xs font-bold transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--fx-accent)] ${
                  isRecording
                    ? 'bg-red-600 border-red-500 text-white shadow-lg shadow-red-600/30'
                    : 'bg-zinc-900 border-zinc-800 text-zinc-300 hover:bg-zinc-850 hover:text-white'
                }`}
                title={isRecording ? 'Stop and download recording' : 'Record this live session'}
              >
                {isRecording ? <Square size={14} className="fill-white" /> : <Disc size={15} className="text-red-400" />}
                <span>{isRecording ? 'Stop recording' : 'Record'}</span>
              </button>
            )}

            {onEndBroadcast && (
              <button
                onClick={onEndBroadcast}
                disabled={isEndingBroadcast}
                className="flex min-h-11 items-center gap-1.5 rounded-lg border border-rose-500/30 bg-rose-500/10 p-2.5 text-xs font-bold text-rose-300 transition-colors hover:bg-rose-500 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--fx-accent)] disabled:cursor-not-allowed disabled:opacity-60"
                title="End broadcast for every participant"
              >
                <Radio size={15} />
                <span>{isEndingBroadcast ? 'Ending…' : 'End broadcast'}</span>
              </button>
            )}
          </>
        )}

        {!isHost && <span className="hidden sm:inline text-xs font-medium text-zinc-400">Watching host broadcast</span>}
      </div>

      {/* Leave Button */}
      <Button
        onClick={onLeave}
        variant="danger"
        size="sm"
        className="min-h-11 px-4 text-xs font-semibold flex items-center gap-1.5 shadow-md shadow-rose-600/10"
      >
        <PhoneOff size={13} />
        <span>Leave</span>
      </Button>
    </div>
  );
}
