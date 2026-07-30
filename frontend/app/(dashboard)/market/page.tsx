'use client';

import React, { useState, useEffect } from 'react';
import { useMarketStore } from '@/stores/marketStore';
import { formatPrice, formatPercentage } from '@/lib/utils';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Search, Star, StarOff, TrendingUp, TrendingDown, RefreshCw } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function MarketPage() {
  const router = useRouter();
  const {
    assets,
    prices,
    watchlists,
    fetchAssets,
    fetchWatchlists,
    createWatchlist,
    addToWatchlist,
    removeFromWatchlist,
    setSelectedAsset,
  } = useMarketStore();

  const [activeTab, setActiveTab] = useState<'all' | 'forex' | 'stock' | 'crypto'>('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    Promise.all([fetchAssets(), fetchWatchlists()]).finally(() => setLoading(false));
  }, [fetchAssets, fetchWatchlists]);

  const activeWatchlist = watchlists.length > 0 ? watchlists[0] : null;

  const isStarred = (assetId: string) => {
    return activeWatchlist?.items.some((item) => item.id === assetId) || false;
  };

  const handleStarToggle = async (assetId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    let wl = activeWatchlist;
    if (!wl) {
      // Auto-create a default watchlist
      await createWatchlist('My Watchlist');
      await fetchWatchlists();
      const updated = useMarketStore.getState().watchlists;
      wl = updated.length > 0 ? updated[0] : null;
      if (!wl) return;
    }

    if (isStarred(assetId)) {
      await removeFromWatchlist(wl.id, assetId);
    } else {
      await addToWatchlist(wl.id, assetId);
    }
    await fetchWatchlists();
  };

  const handleTradeClick = (asset: any) => {
    setSelectedAsset(asset);
    router.push('/dashboard');
  };

  const filteredAssets = assets.filter((asset) => {
    const matchesSearch =
      asset.symbol.toLowerCase().includes(search.toLowerCase()) ||
      asset.name.toLowerCase().includes(search.toLowerCase());

    if (!matchesSearch) return false;
    if (activeTab === 'all') return true;
    return asset.asset_type === activeTab;
  });

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex items-center justify-between select-none">
        <div>
          <h2 className="text-sm font-bold text-white uppercase tracking-wider">Asset Registry Terminal</h2>
          <p className="text-[10px] text-zinc-500 mt-0.5">Explore active currency pairs, equities, and cryptocurrency feeds.</p>
        </div>
        
        <button
          onClick={() => {
            setLoading(true);
            Promise.all([fetchAssets(), fetchWatchlists()]).finally(() => setLoading(false));
          }}
          disabled={loading}
          className="p-1.5 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800/50 transition-colors"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Filtering Controls */}
      <div className="flex flex-col sm:flex-row gap-4 items-center justify-between select-none bg-zinc-950/20 p-4 border border-zinc-900 rounded-xl">
        <div className="flex gap-1.5">
          {(['all', 'forex', 'stock', 'crypto'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-3 py-1.5 rounded-lg text-xs capitalize transition-colors font-semibold ${
                activeTab === tab
                  ? 'bg-blue-600/10 border border-blue-500/30 text-blue-400'
                  : 'bg-transparent text-zinc-450 hover:text-zinc-200 border border-transparent'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-64">
          <Search size={13} className="absolute left-3 top-2.5 text-zinc-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter symbols or names..."
            className="w-full h-8 pl-8 pr-3 bg-zinc-900/60 text-xs border border-zinc-850 rounded-lg text-white placeholder-zinc-550 focus:outline-none focus:border-zinc-750"
          />
        </div>
      </div>

      {/* Assets Grid/Table */}
      <Card className="border border-zinc-900 bg-zinc-950/40 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-zinc-300">
            <thead className="bg-zinc-900/40 text-[10px] text-zinc-500 uppercase font-bold tracking-wider select-none border-b border-zinc-900">
              <tr>
                <th className="p-4 w-12 text-center">Watch</th>
                <th className="p-4">Symbol</th>
                <th className="p-4">Asset Name</th>
                <th className="p-4">Asset Class</th>
                <th className="p-4 text-right">Quote Price</th>
                <th className="p-4 text-right">24h Change</th>
                <th className="p-4 text-right">Volume</th>
                <th className="p-4 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-900/60">
              {filteredAssets.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-zinc-550 select-none">
                    No tradeable assets match your search parameters.
                  </td>
                </tr>
              ) : (
                filteredAssets.map((asset) => {
                  const priceData = prices[asset.symbol.toUpperCase()];
                  const price = priceData ? priceData.price : null;
                  const changePct = priceData ? priceData.change_pct : 0;
                  const volume = priceData ? priceData.volume : null;
                  const isUp = changePct >= 0;
                  const starred = isStarred(asset.id);

                  return (
                    <tr
                      key={asset.id}
                      className="hover:bg-zinc-900/10 cursor-pointer transition-colors"
                      onClick={() => handleTradeClick(asset)}
                    >
                      <td className="p-4 text-center" onClick={(e) => handleStarToggle(asset.id, e)}>
                        {starred ? (
                          <Star size={14} className="text-amber-400 fill-amber-400/20 hover:scale-115 transition-transform" />
                        ) : (
                          <StarOff size={14} className="text-zinc-650 hover:text-amber-400 transition-colors" />
                        )}
                      </td>
                      <td className="p-4 font-bold text-white uppercase">{asset.symbol}</td>
                      <td className="p-4 text-zinc-400">{asset.name}</td>
                      <td className="p-4">
                        <span className="text-[9px] font-semibold text-zinc-500 uppercase px-1.5 py-0.5 bg-zinc-900 border border-zinc-850 rounded">
                          {asset.asset_type}
                        </span>
                      </td>
                      <td className="p-4 text-right font-semibold font-mono text-zinc-200">
                        {price !== null ? formatPrice(price, asset.symbol) : '---'}
                      </td>
                      <td className="p-4 text-right">
                        <span className={`inline-flex items-center gap-0.5 font-semibold font-mono ${isUp ? 'text-emerald-400' : 'text-red-400'}`}>
                          {isUp ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                          {formatPercentage(changePct)}
                        </span>
                      </td>
                      <td className="p-4 text-right font-mono text-zinc-400">
                        {volume !== null ? volume.toLocaleString() : '---'}
                      </td>
                      <td className="p-4 text-center">
                        <Button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleTradeClick(asset);
                          }}
                          size="sm"
                          className="h-7 text-[10px] bg-blue-600/10 border border-blue-500/20 text-blue-400 hover:bg-blue-600/20 font-bold"
                        >
                          Trade
                        </Button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
