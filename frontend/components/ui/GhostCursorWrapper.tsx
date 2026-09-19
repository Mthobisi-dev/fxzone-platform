'use client';

import dynamic from 'next/dynamic';

const GhostCursor = dynamic(
  () => import('@/components/ui/GhostCursor').then((mod) => mod.GhostCursor),
  { ssr: false }
);

export function GhostCursorWrapper() {
  return (
    <GhostCursor
      color="#60a5fa"
      brightness={0.85}
      bloomStrength={0.15}
      bloomRadius={0.6}
      trailLength={25}
      inertia={0.4}
      grainIntensity={0.02}
      mixBlendMode="screen"
      zIndex={1}
    />
  );
}
