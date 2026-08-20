'use client';

import React, { useRef, useEffect, useState } from 'react';
import { Monitor, Maximize2, Minimize2, Volume2, VolumeX, Play } from 'lucide-react';

interface ScreenShareProps {
  stream: MediaStream | null;
  presenterName: string;
  isLocal?: boolean;
}

export function ScreenShare({ stream, presenterName, isLocal = false }: ScreenShareProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [needsUserInteraction, setNeedsUserInteraction] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isMuted, setIsMuted] = useState(isLocal);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (stream && stream.active) {
      video.srcObject = stream;
      video.muted = isLocal || isMuted;

      const attemptPlay = () => {
        const playPromise = video.play();
        if (playPromise !== undefined) {
          playPromise
            .then(() => {
              setIsPlaying(true);
              setNeedsUserInteraction(false);
            })
            .catch((err) => {
              console.warn('ScreenShare autoplay prevented by browser policy:', err);
              setNeedsUserInteraction(true);
            });
        }
      };

      attemptPlay();

      // Listen to track state changes
      const handleTrackEnded = () => {
        const hasLiveVideo = stream.getVideoTracks().some((t) => t.readyState === 'live');
        if (!hasLiveVideo && videoRef.current) {
          videoRef.current.srcObject = null;
          setIsPlaying(false);
        }
      };

      stream.getVideoTracks().forEach((track) => {
        track.addEventListener('ended', handleTrackEnded);
        track.addEventListener('mute', () => setIsPlaying(false));
        track.addEventListener('unmute', attemptPlay);
      });

      return () => {
        stream.getVideoTracks().forEach((track) => {
          track.removeEventListener('ended', handleTrackEnded);
        });
      };
    } else {
      video.srcObject = null;
      setIsPlaying(false);
      setNeedsUserInteraction(false);
    }
  }, [stream, isLocal, isMuted]);

  const handleManualPlay = () => {
    if (videoRef.current) {
      videoRef.current
        .play()
        .then(() => {
          setIsPlaying(true);
          setNeedsUserInteraction(false);
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
    }
  };

  return (
    <div className="relative w-full h-full bg-zinc-950 border border-zinc-850 rounded-xl overflow-hidden flex items-center justify-center group shadow-2xl">
      {stream && stream.active ? (
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
            <div
              onClick={handleManualPlay}
              className="absolute inset-0 bg-black/75 backdrop-blur-sm flex flex-col items-center justify-center cursor-pointer z-30 select-none p-4"
            >
              <div className="h-14 w-14 rounded-full bg-blue-600 hover:bg-blue-500 flex items-center justify-center text-white shadow-xl shadow-blue-600/30 mb-3 animate-bounce">
                <Play size={24} className="ml-1" />
              </div>
              <p className="text-xs font-bold text-white uppercase tracking-wider">Click to Watch Screen Broadcast</p>
              <span className="text-[10px] text-zinc-400 mt-1">Browser requires interaction to activate audio & video</span>
            </div>
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
          <div className="absolute top-4 right-4 flex items-center gap-2 z-20 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
            {!isLocal && (
              <button
                onClick={toggleAudio}
                className="p-2 bg-zinc-950/80 hover:bg-zinc-900 border border-zinc-850 rounded-lg text-zinc-300 hover:text-white transition-colors"
                title={isMuted ? 'Unmute stream audio' : 'Mute stream audio'}
              >
                {isMuted ? <VolumeX size={14} className="text-rose-400" /> : <Volume2 size={14} className="text-emerald-400" />}
              </button>
            )}

            <button
              onClick={toggleFullscreen}
              className="p-2 bg-zinc-950/80 hover:bg-zinc-900 border border-zinc-850 rounded-lg text-zinc-300 hover:text-white transition-colors"
              title={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
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
          <h4 className="text-xs font-bold text-zinc-200">Screen Broadcast Idle</h4>
          <p className="text-[10px] text-zinc-500 max-w-[240px] mt-1.5 leading-relaxed">
            The host or presenter has not started sharing a screen yet. Live video and audio will stream here automatically once started.
          </p>
        </div>
      )}
    </div>
  );
}
