'use client';

import dynamic from 'next/dynamic';

const ColorBends = dynamic(
  () => import('@/components/ui/ColorBends').then((mod) => mod.ColorBends),
  { ssr: false }
);

export function ColorBendsBackground() {
  return (
    <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
      <ColorBends
        colors={["#1e3a8a", "#5b21b6", "#0e7490", "#3730a3"]}
        rotation={90}
        speed={0.15}
        scale={1.3}
        frequency={1}
        warpStrength={1}
        mouseInfluence={0.6}
        noise={0.08}
        parallax={0.3}
        iterations={2}
        intensity={1.1}
        bandWidth={6}
        transparent={true}
      />
    </div>
  );
}
