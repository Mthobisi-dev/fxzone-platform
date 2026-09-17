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
        colors={["#111827", "#1e1b4b", "#0f172a", "#1e293b"]}
        rotation={90}
        speed={0.10}
        scale={1.4}
        frequency={1}
        warpStrength={0.8}
        mouseInfluence={0.4}
        noise={0.04}
        parallax={0.2}
        iterations={2}
        intensity={0.8}
        bandWidth={6}
        transparent={true}
      />
    </div>
  );
}
