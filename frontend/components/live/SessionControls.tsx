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
  Settings,
  Download,
} from 'lucide-react';
import { Button } from '../ui/Button';

interface SessionControlsProps {
  isHost: boolean;
  isSharing: boolean;
  isRecording?: boolean;
  recordingDuration?: string;
  onToggleMic: (enabled: boolean) => void;
  onToggleCamera: (enabled: boolean) => void;
  onToggleShare: (enabled: boolean) => void;
  onToggleRecord?: () => void;
  onLeave: () => void;
  startTime?: string | Date;
}

export function SessionControls({
  isHost,
  isSharing,
  isRecording = false,
  recordingDuration = '00:00',
  onToggleMic,
  onToggleCamera,
  onToggleShare,
  onToggleRecord,
  onLeave,
  startTime = new Date(),
}: SessionControlsProps) {
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(false);
  const [duration, setDuration] = useState('00:00:00');
  const [showOptMenu, setShowOptMenu] = useState(false);

  useEffect(() => {
    const start = new Date(startTime).getTime();

    const interval = setInterval(() => {
      const diff = Math.max(0, Date.now() - start);
      const hrs = Math.floor(diff / 3600000).toString().padStart(2, '0');
      const mins = Math.floor((diff % 3600000) / 60000).toString().padStart(2, '0');
      const secs = Math.floor((diff % 60000) / 1000).toString().padStart(2, '0');
      setDuration(`${hrs}:${mins}:${secs}`);
    }, 1000);

    return () => clearInterval(interval);
  }, [startTime]);

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
    onToggleShare(!isSharing);
  };

  return (
    <div className="bg-zinc-950 border border-zinc-850 rounded-xl px-4 py-3 flex items-center justify-between gap-4 select-none relative">
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
      <div className="flex items-center gap-2.5">
        {/* Microphone */}
        <button
          onClick={handleMic}
          className={`p-2.5 rounded-lg border transition-all ${
            micOn
              ? 'bg-zinc-900 border-zinc-800 text-zinc-200 hover:bg-zinc-850'
              : 'bg-rose-500/10 border-rose-500/30 text-rose-400 hover:bg-rose-500/20'
          }`}
          title={micOn ? 'Mute Microphone' : 'Unmute Microphone'}
        >
          {micOn ? <Mic size={15} /> : <MicOff size={15} />}
        </button>

        {/* Camera (Presenters only) */}
        {isHost && (
          <button
            onClick={handleCam}
            className={`p-2.5 rounded-lg border transition-all ${
              camOn
                ? 'bg-blue-600/20 border-blue-500/40 text-blue-400 hover:bg-blue-600/30'
                : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:bg-zinc-850 hover:text-white'
            }`}
            title={camOn ? 'Stop Camera' : 'Start Camera'}
          >
            {camOn ? <Video size={15} /> : <VideoOff size={15} />}
          </button>
        )}

        {/* Screen Share (Available to all traders in the room) */}
        <button
          onClick={handleShare}
          className={`p-2.5 rounded-lg border transition-all flex items-center gap-1.5 font-bold text-xs ${
            isSharing
              ? 'bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-600/30 animate-pulse'
              : 'bg-zinc-900 border-zinc-800 text-zinc-300 hover:bg-zinc-850 hover:text-white'
          }`}
          title={isSharing ? 'Stop Screen Share' : 'Share Screen with Room'}
        >
          {isSharing ? <ScreenShareOff size={15} /> : <ScreenShare size={15} />}
          <span className="hidden sm:inline">{isSharing ? 'Stop Share' : 'Share Screen'}</span>
        </button>

        {/* Session Recording Button (Opt-in recording) */}
        {onToggleRecord && (
          <button
            onClick={onToggleRecord}
            className={`p-2.5 rounded-lg border transition-all flex items-center gap-1.5 font-bold text-xs ${
              isRecording
                ? 'bg-red-600 border-red-500 text-white shadow-lg shadow-red-600/30'
                : 'bg-zinc-900 border-zinc-800 text-zinc-300 hover:bg-zinc-850 hover:text-white'
            }`}
            title={isRecording ? 'Stop & Download Recording' : 'Opt-in Record Live Session'}
          >
            {isRecording ? <Square size={14} className="fill-white" /> : <Disc size={15} className="text-red-400" />}
            <span className="hidden sm:inline">{isRecording ? 'Stop Recording' : 'Record'}</span>
          </button>
        )}
      </div>

      {/* Leave Button */}
      <Button
        onClick={onLeave}
        variant="danger"
        size="sm"
        className="h-9 px-4 text-xs font-semibold flex items-center gap-1.5 shadow-md shadow-rose-600/10"
      >
        <PhoneOff size={13} />
        <span>Leave</span>
      </Button>
    </div>
  );
}
