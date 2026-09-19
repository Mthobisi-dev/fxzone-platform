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
      brightness={1.6}
      bloomStrength={0.35}
      bloomRadius={1.2}
      trailLength={45}
      inertia={0.6}
      grainIntensity={0.03}
      mixBlendMode="screen"
      zIndex={40}
    />
  );
}
