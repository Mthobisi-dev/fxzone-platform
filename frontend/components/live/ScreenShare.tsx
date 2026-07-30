'use client';

import React, { useRef, useEffect } from 'react';
import { Monitor, Maximize2, Minimize2 } from 'lucide-react';

interface ScreenShareProps {
  stream: MediaStream | null;
  presenterName: string;
  isLocal?: boolean;
}

export function ScreenShare({ stream, presenterName, isLocal = false }: ScreenShareProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  const toggleFullscreen = () => {
    if (videoRef.current) {
      if (!document.fullscreenElement) {
        videoRef.current.requestFullscreen().catch((err) => {
          console.error(`Fullscreen request failed: ${err.message}`);
        });
      } else {
        document.exitFullscreen();
      }
    }
  };

  return (
    <div className="relative w-full h-full bg-zinc-950 border border-zinc-850 rounded-xl overflow-hidden flex items-center justify-center group shadow-2xl">
      {stream ? (
        <>
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted={isLocal}
            className="w-full h-full object-contain"
          />
          
          {/* Presenter Name Badge Overlay */}
          <div className="absolute bottom-4 left-4 bg-zinc-950/85 backdrop-blur border border-zinc-850 px-3 py-1.5 rounded-lg flex items-center gap-1.5 text-xs text-white select-none">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500" />
            </span>
            <span className="font-semibold">{presenterName}</span>
            {isLocal && <span className="text-[10px] text-zinc-400">(Your Screen)</span>}
          </div>

          {/* Fullscreen Button Overlay */}
          <button
            onClick={toggleFullscreen}
            className="absolute bottom-4 right-4 p-2 bg-zinc-950/80 border border-zinc-850 rounded-lg text-zinc-400 hover:text-white transition-colors hover:bg-zinc-900 opacity-0 group-hover:opacity-100 transition-opacity duration-200"
          >
            <Maximize2 size={14} />
          </button>
        </>
      ) : (
        <div className="flex flex-col items-center justify-center p-8 text-center select-none">
          <div className="h-12 w-12 bg-zinc-900 border border-zinc-800 text-zinc-500 rounded-xl flex items-center justify-center mb-3">
            <Monitor size={20} />
          </div>
          <h4 className="text-xs font-semibold text-zinc-300">Waiting for Stream</h4>
          <p className="text-[10px] text-zinc-550 max-w-[220px] mt-1 leading-relaxed">
            The host has not started screen sharing yet, or the broadcast is currently loading.
          </p>
        </div>
      )}
    </div>
  );
}
