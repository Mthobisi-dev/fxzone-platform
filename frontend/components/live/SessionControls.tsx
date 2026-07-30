'use client';

import React, { useState, useEffect } from 'react';
import { Mic, MicOff, Video, VideoOff, ScreenShare, ScreenShareOff, PhoneOff } from 'lucide-react';
import { Button } from '../ui/Button';

interface SessionControlsProps {
  isHost: boolean;
  onToggleMic: (enabled: boolean) => void;
  onToggleCamera: (enabled: boolean) => void;
  onToggleShare: (enabled: boolean) => void;
  onLeave: () => void;
  startTime?: string | Date;
}

export function SessionControls({
  isHost,
  onToggleMic,
  onToggleCamera,
  onToggleShare,
  onLeave,
  startTime = new Date(),
}: SessionControlsProps) {
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(false);
  const [shareOn, setShareOn] = useState(false);
  const [duration, setDuration] = useState('00:00:00');

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
    const val = !shareOn;
    setShareOn(val);
    onToggleShare(val);
  };

  return (
    <div className="bg-zinc-950 border border-zinc-850 rounded-xl px-4 py-3 flex items-center justify-between gap-4 select-none">
      {/* Timer */}
      <div className="flex items-center gap-2">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
        </span>
        <span className="text-xs font-mono font-bold text-zinc-300">{duration}</span>
      </div>

      {/* Buttons */}
      <div className="flex items-center gap-3">
        {/* Mic */}
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
                ? 'bg-zinc-900 border-zinc-800 text-zinc-200 hover:bg-zinc-850'
                : 'bg-rose-500/10 border-rose-500/30 text-rose-400 hover:bg-rose-500/20'
            }`}
            title={camOn ? 'Stop Camera' : 'Start Camera'}
          >
            {camOn ? <Video size={15} /> : <VideoOff size={15} />}
          </button>
        )}

        {/* Screen Share (Presenters only) */}
        {isHost && (
          <button
            onClick={handleShare}
            className={`p-2.5 rounded-lg border transition-all ${
              shareOn
                ? 'bg-blue-600 border-blue-500 text-white hover:bg-blue-500'
                : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:bg-zinc-850 hover:text-white'
            }`}
            title={shareOn ? 'Stop Screen Share' : 'Start Screen Share'}
          >
            {shareOn ? <ScreenShareOff size={15} /> : <ScreenShare size={15} />}
          </button>
        )}
      </div>

      {/* Leave */}
      <Button
        onClick={onLeave}
        variant="danger"
        size="sm"
        className="h-9 px-4 text-xs font-semibold flex items-center gap-1.5"
      >
        <PhoneOff size={13} />
        <span>Leave</span>
      </Button>
    </div>
  );
}
