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
    <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden bg-[#05070d] transition-opacity duration-500">
      <ColorBends
        colors={["#2563eb", "#4f46e5", "#7c3aed", "#06b6d4", "#3b82f6"]}
        rotation={90}
        speed={0.15}
        scale={1.2}
        frequency={1.2}
        warpStrength={1.2}
        mouseInfluence={0.8}
        noise={0.03}
        parallax={0.4}
        iterations={2}
        intensity={1.4}
        bandWidth={6}
        transparent={true}
      />
    </div>
  );
}
