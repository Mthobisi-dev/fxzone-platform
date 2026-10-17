'use client';

import React, { useRef, useEffect, useState } from 'react';
import { Monitor, Maximize2, Minimize2, Volume2, VolumeX, Play, Check } from 'lucide-react';

interface ScreenShareProps {
  stream: MediaStream | null;
  presenterName: string;
  isLocal?: boolean;
  isHost?: boolean;
}

export function ScreenShare({ stream, presenterName, isLocal = false, isHost = false }: ScreenShareProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [blockedStream, setBlockedStream] = useState<MediaStream | null>(null);
  const needsUserInteraction = Boolean(stream && stream === blockedStream && stream.active);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isMuted, setIsMuted] = useState(true);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || isLocal) return;
    let disposed = false;

    if (stream && stream.active) {
      video.srcObject = stream;

      const attemptPlay = () => {
        const playPromise = video.play();
        if (playPromise !== undefined) {
          playPromise
            .then(() => {
              if (!disposed) setBlockedStream(null);
            })
            .catch((err) => {
              console.warn('ScreenShare autoplay prevented by browser policy:', err);
              if (!disposed) setBlockedStream(stream);
            });
        }
      };

      attemptPlay();

      // Listen to track state changes
      const handleTrackEnded = () => {
        const hasLiveVideo = stream.getVideoTracks().some((t) => t.readyState === 'live');
        if (!hasLiveVideo && videoRef.current) {
          videoRef.current.srcObject = null;
          setBlockedStream(null);
        }
      };

      stream.getVideoTracks().forEach((track) => {
        track.addEventListener('ended', handleTrackEnded);
        track.addEventListener('unmute', attemptPlay);
      });

      return () => {
        disposed = true;
        stream.getVideoTracks().forEach((track) => {
          track.removeEventListener('ended', handleTrackEnded);
          track.removeEventListener('unmute', attemptPlay);
        });
        video.pause();
        video.srcObject = null;
      };
    } else {
      video.srcObject = null;
    }
  }, [stream, isLocal]);

  useEffect(() => {
    if (videoRef.current) videoRef.current.muted = isLocal || isMuted;
  }, [stream, isLocal, isMuted]);

  useEffect(() => {
    const sync = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', sync);
    return () => document.removeEventListener('fullscreenchange', sync);
  }, []);

  const handleManualPlay = () => {
    if (videoRef.current) {
      videoRef.current
        .play()
        .then(() => {
          setBlockedStream(null);
        })
        .catch((e) => console.error('Manual play failed:', e));
    }
  };

  const toggleFullscreen = () => {
    const container = videoRef.current?.parentElement;
    if (container) {
      if (!document.fullscreenElement) {
        container.requestFullscreen().then(() => setIsFullscreen(true)).catch((err) => {
          console.error(`Fullscreen request failed: ${err.message}`);
        });
      } else {
        document.exitFullscreen().then(() => setIsFullscreen(false));
      }
    }
  };

  const toggleAudio = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (videoRef.current) {
      const nextMuted = !videoRef.current.muted;
      videoRef.current.muted = nextMuted;
      setIsMuted(nextMuted);
      void videoRef.current.play().catch(() => setBlockedStream(stream));
    }
  };

  return (
    <div className="relative w-full h-full bg-zinc-950 border border-zinc-850 rounded-xl overflow-hidden flex items-center justify-center group shadow-2xl">
      {isLocal && stream ? (
        <div className="max-w-md p-6 text-center" role="status">
          <Check size={32} className="mx-auto mb-4 text-emerald-500" />
          <h3 className="text-base font-semibold text-zinc-100">You are sharing your screen</h3>
          <p className="mt-2 text-sm leading-relaxed text-zinc-400">Your viewers see the tab or window you selected. Your preview is hidden to prevent the screen repeating inside itself.</p>
          <p className="mt-3 text-xs text-zinc-400">Keep your presentation open. You can approve requests and chat here.</p>
        </div>
      ) : stream && stream.active ? (
        <>
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted={isLocal || isMuted}
            className="w-full h-full object-contain bg-black"
          />

          {/* Autoplay blocked overlay */}
          {needsUserInteraction && (
            <button
              onClick={handleManualPlay}
              className="absolute inset-0 bg-black/75 backdrop-blur-sm flex flex-col items-center justify-center cursor-pointer z-30 select-none p-4"
            >
              <div className="h-14 w-14 rounded-full bg-blue-600 hover:bg-blue-500 flex items-center justify-center text-white shadow-xl shadow-blue-600/30 mb-3 animate-bounce">
                <Play size={24} className="ml-1" />
              </div>
              <p className="text-sm font-semibold text-white">Tap to watch the broadcast</p>
              <span className="text-xs text-zinc-400 mt-1">Your browser requires a tap to start playback.</span>
            </button>
          )}

          {/* Presenter Name Badge Overlay */}
          <div className="absolute bottom-4 left-4 bg-zinc-950/85 backdrop-blur border border-zinc-850 px-3 py-1.5 rounded-lg flex items-center gap-2 text-xs text-white select-none z-20">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>
            <span className="font-semibold">{presenterName}</span>
            {isLocal && <span className="text-[10px] text-zinc-400 font-medium">(Sharing Your Screen)</span>}
          </div>

          {/* Top-Right Control Overlays */}
          <div className="absolute top-3 right-3 flex items-center gap-2 z-20">
            {!isLocal && (
              <button
                onClick={toggleAudio}
                className="p-3 flex items-center gap-2 bg-zinc-950/80 hover:bg-zinc-900 border border-zinc-850 rounded-lg text-zinc-300 hover:text-white transition-colors"
                aria-label={isMuted ? 'Enable broadcast audio' : 'Mute broadcast audio'}
                title={isMuted ? 'Unmute stream audio' : 'Mute stream audio'}
              >
                {isMuted ? <VolumeX size={14} className="text-rose-400" /> : <Volume2 size={14} className="text-emerald-400" />}
                <span className="text-xs">{isMuted ? 'Enable audio' : 'Mute'}</span>
              </button>
            )}

            <button
              onClick={toggleFullscreen}
              className="p-2 bg-zinc-950/80 hover:bg-zinc-900 border border-zinc-850 rounded-lg text-zinc-300 hover:text-white transition-colors"
              title={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
              aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
            >
              {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
            </button>
          </div>
        </>
      ) : (
        <div className="flex flex-col items-center justify-center p-8 text-center select-none">
          <div className="h-14 w-14 bg-zinc-900 border border-zinc-800 text-zinc-500 rounded-2xl flex items-center justify-center mb-3 shadow-inner">
            <Monitor size={24} />
          </div>
          <h4 className="text-sm font-semibold text-zinc-200">{isHost ? 'Your broadcast room is ready' : 'You’re in. Waiting for the host’s screen.'}</h4>
          <p className="text-sm text-zinc-400 max-w-sm mt-2 leading-relaxed">
            {isHost ? 'Choose Share screen, then select your presentation tab or window. Approve followers in Access requests.' : 'The screen will appear here when the host starts sharing. You can say hello in the chat while you wait.'}
          </p>
        </div>
      )}
    </div>
  );
}
