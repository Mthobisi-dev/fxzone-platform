'use client';

import React, { useEffect, useState } from 'react';
import { CandlestickChart } from '@/components/trading/CandlestickChart';
import { WatchlistPanel } from '@/components/trading/WatchlistPanel';
import { OrderBook } from '@/components/trading/OrderBook';
import { MarketOverview } from '@/components/trading/MarketOverview';
import { NewsFeed } from '@/components/news/NewsFeed';
import { AIInsightCard } from '@/components/ai/AIInsightCard';
import { useMarketStore } from '@/stores/marketStore';
import { api } from '@/lib/api';
import { Loader2 } from 'lucide-react';
import { timeAgo } from '@/lib/utils';

export default function DashboardPage() {
  const { assets, fetchAssets, fetchPrices, selectedAsset, setSelectedAsset } = useMarketStore();
  const [aiInsights, setAIInsights] = useState<any[]>([]);
  const [loadingInsights, setLoadingInsights] = useState(false);

  // Initialize assets and market prices
  useEffect(() => {
    fetchAssets();
    fetchPrices();
    const interval = setInterval(fetchPrices, 30000);
    return () => clearInterval(interval);
  }, [fetchAssets, fetchPrices]);

  // Set default asset once assets are loaded
  useEffect(() => {
    if (assets.length > 0 && !selectedAsset) {
      setSelectedAsset(assets[0]);
    }
  }, [assets, selectedAsset, setSelectedAsset]);

  // Fetch AI Insights for watchlist
  const fetchInsights = async () => {
    setLoadingInsights(true);
    try {
      const res = await api.get('/api/ai/insights');
      const rawInsights = Array.isArray(res) ? res : (res && Array.isArray(res.insights) ? res.insights : []);
      
      if (rawInsights && rawInsights.length > 0) {
        const formatted = rawInsights.map((item: any) => {
          let confidence = item.confidence || 0.70;
          if (confidence <= 1.0) {
            confidence = Math.round(confidence * 100);
          }
          
          let keyPoints = [];
          if (item.keyPoints && Array.isArray(item.keyPoints)) {
            keyPoints = item.keyPoints;
          } else if (item.summary) {
            keyPoints = item.summary
              .split(/[.\n]+/)
              .map((s: string) => s.trim())
              .filter((s: string) => s.length > 5);
          }
          
          if (keyPoints.length === 0) {
            keyPoints = ["Consensus points to range-bound stability."];
          }

          return {
            symbol: item.symbol,
            name: item.name || item.symbol,
            sentiment: item.sentiment || 'neutral',
            confidence: confidence,
            keyPoints: keyPoints,
            lastUpdated: item.timestamp ? timeAgo(item.timestamp) : 'Just now'
          };
        });
        setAIInsights(formatted);
      } else {
        // No insights available — show empty state
        setAIInsights([]);
      }
    } catch (err) {
      console.error('Failed to load AI insights:', err);
    } finally {
      setLoadingInsights(false);
    }
  };

  useEffect(() => {
    fetchInsights();
    // Auto-refresh Google AI Watchlist Insights every 10 minutes
    const interval = setInterval(() => {
      fetchInsights();
    }, 600000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Top Heatmap Overview */}
      <div className="w-full">
        <MarketOverview />
      </div>

      {/* Main Core Trading Layout */}
      <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
        {/* Left Side: Watchlist Panel */}
        <div className="xl:col-span-1 h-[470px]">
          <WatchlistPanel />
        </div>

        {/* Center: Candlestick Chart */}
        <div className="xl:col-span-2 h-[470px]">
          <CandlestickChart />
        </div>

        {/* Right Side: Order Book Flow */}
        <div className="xl:col-span-1 h-[470px]">
          <OrderBook />
        </div>
      </div>

      {/* Bottom Insights and News Splits */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Left/Middle: Google AI Insights */}
        <div className="xl:col-span-2 space-y-4">
          <div className="flex items-center justify-between select-none">
            <h3 className="text-xs font-bold text-white uppercase tracking-wider">Google AI Watchlist Insights</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {loadingInsights ? (
              <div className="col-span-2 h-40 flex items-center justify-center">
                <Loader2 className="animate-spin text-purple-500" size={24} />
              </div>
            ) : aiInsights.length === 0 ? (
              <div className="col-span-2 text-center py-12 text-zinc-550 text-xs italic">
                No active watchlist insights at this moment.
              </div>
            ) : (
              aiInsights.map((insight, index) => (
                <AIInsightCard 
                  key={index} 
                  insight={insight} 
                  onViewDetails={(symbol) => {
                    const match = assets.find((a) => a.symbol.toUpperCase() === symbol.toUpperCase());
                    if (match) setSelectedAsset(match);
                  }}
                />
              ))
            )}
          </div>
        </div>

        {/* Right: Market News Feed */}
        <div className="xl:col-span-1 h-[450px]">
          <NewsFeed />
        </div>
      </div>
    </div>
  );
}
