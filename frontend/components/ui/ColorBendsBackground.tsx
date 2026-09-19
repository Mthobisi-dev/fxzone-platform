'use client';

import dynamic from 'next/dynamic';

const ColorBends = dynamic(
  () => import('@/components/ui/ColorBends').then((mod) => mod.ColorBends),
  {
    ssr: false,
    loading: () => <div className="fixed inset-0 bg-[#05070d] pointer-events-none z-0" />,
  }
);

export function ColorBendsBackground() {
  return (
    <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden bg-[#05070d] opacity-75 transition-opacity duration-500">
      <ColorBends
        colors={["#1d4ed8", "#4338ca", "#6d28d9", "#0e7490", "#2563eb"]}
        rotation={90}
        speed={0.12}
        scale={1.3}
        frequency={1.0}
        warpStrength={1.0}
        mouseInfluence={0.5}
        noise={0.03}
        parallax={0.3}
        iterations={2}
        intensity={1.0}
        bandWidth={6}
        transparent={true}
      />
    </div>
  );
}
