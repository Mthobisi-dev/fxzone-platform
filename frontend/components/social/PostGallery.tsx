'use client';

import { useEffect, useRef, useState } from 'react';
import { playExclusive, releaseMedia } from '@/lib/mediaPlayback';

function FeedVideo({ src, active }: { src: string; active: boolean }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    let visible = false;
    const update = () => {
      if (active && visible && document.visibilityState === 'visible') {
        void video.play().catch(() => { /* Browser may require a tap. Controls remain available. */ });
      } else { video.pause(); releaseMedia(video); }
    };
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting && entry.intersectionRatio >= 0.65;
      update();
    }, { threshold: [0, 0.65, 1] });
    observer.observe(video);
    document.addEventListener('visibilitychange', update);
    update();
    return () => {
      observer.disconnect();
      document.removeEventListener('visibilitychange', update);
      video.pause();
      releaseMedia(video);
    };
  }, [active]);
  return <video ref={ref} src={src} controls muted playsInline preload="metadata" onPlay={e => playExclusive(e.currentTarget)} className="w-full max-h-[65svh] object-contain" />;
}

export function PostGallery({ urls }: { urls: string[] }) {
  const track = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  if (!urls.length) return null;
  const go = (next: number) => track.current?.scrollTo({ left: next * track.current.clientWidth, behavior: 'smooth' });
  return <div className="mb-3 overflow-hidden rounded-xl border border-border" onClick={e => e.stopPropagation()}>
    <div ref={track} className="flex snap-x snap-mandatory overflow-x-auto overscroll-x-contain [scrollbar-width:none]" onScroll={e => {
      const el = e.currentTarget;
      setIndex(Math.round(el.scrollLeft / (el.clientWidth || 1)));
    }}>
      {urls.map((url, i) => {
        const path = url.split(/[?#]/)[0];
        const isAudio = url.endsWith('#fxzone-audio') || /\.(mp3|wav|ogg|m4a|aac)$/i.test(path);
        return <div key={`${url}-${i}`} className="flex w-full shrink-0 snap-center items-center justify-center bg-[var(--color-card)]" role="group" aria-label={`Attachment ${i + 1} of ${urls.length}`}>
          {!isAudio && /\.(mp4|mov|webm|mkv|m4v)$/i.test(path) ? <FeedVideo src={url} active={i === index} />
            : isAudio ? <audio src={url} controls preload="none" className="w-full" onPlay={e => playExclusive(e.currentTarget)} />
            : /\.pdf$/i.test(path) ? <a href={url} target="_blank" rel="noopener noreferrer" className="p-6 text-blue-600 dark:text-blue-400 underline">Open document</a>
            : <img src={url} alt={`Post attachment ${i + 1}`} loading="lazy" className="w-full max-h-[65svh] object-contain" />}
        </div>;
      })}
    </div>
    {urls.length > 1 && <div className="flex items-center justify-between bg-[var(--color-card)] px-3 py-1 text-xs text-[var(--color-text)]">
      <button type="button" aria-label="Previous attachment" disabled={index === 0} onClick={() => go(index - 1)} className="min-h-10 px-3 disabled:opacity-30">←</button>
      <span aria-live="polite">{index + 1} / {urls.length} · Swipe to view</span>
      <button type="button" aria-label="Next attachment" disabled={index === urls.length - 1} onClick={() => go(index + 1)} className="min-h-10 px-3 disabled:opacity-30">→</button>
    </div>}
  </div>;
}
