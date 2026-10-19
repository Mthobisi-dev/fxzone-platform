'use client';

import { MarketResearchPanel } from '@/components/trading/MarketResearchPanel';
import { LiveMarketScreener } from '@/components/trading/LiveMarketScreener';
import { densityClass, type WorkspaceDensity } from '@/lib/workspaceDensity';
import { useThemeStore } from '@/stores/themeStore';

export default function DashboardPage() {
  const density = useThemeStore((state) => state.density);
  const workspaceDensity: WorkspaceDensity = density === 'scalper' ? 'compact' : 'comfortable';
  return (
    <div className={`mx-auto max-w-[1800px] p-2 pb-24 sm:p-3 md:p-4 md:pb-6 ${densityClass(workspaceDensity)}`}>
      <LiveMarketScreener className={workspaceDensity === 'compact' ? 'text-[0.95em]' : undefined} />
      <MarketResearchPanel className={workspaceDensity === 'compact' ? 'text-[0.95em]' : undefined} />
    </div>
  );
}
