'use client';

import { LiveMarketScreener } from '@/components/trading/LiveMarketScreener';

export default function DashboardPage() {
  return (
    <div className="mx-auto max-w-[1600px] p-2.5 pb-24 sm:p-4 md:p-6 md:pb-6">
      <LiveMarketScreener />
    </div>
  );
}