'use client';

import { LiveMarketScreener } from '@/components/trading/LiveMarketScreener';
import { MarketResearchPanel } from '@/components/trading/MarketResearchPanel';

export default function DashboardPage() {
  return (
    <div className="mx-auto max-w-[1600px] space-y-5 p-2.5 pb-24 sm:space-y-6 sm:p-4 md:p-6 md:pb-6">
      <LiveMarketScreener />
      <MarketResearchPanel />
    </div>
  );
}
