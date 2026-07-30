'use client';

import React, { useState, useEffect } from 'react';
import { useMarketStore } from '@/stores/marketStore';
import { formatPrice, formatPercentage } from '@/lib/utils';
import { Plus, Trash, Star, Search, PlusCircle } from 'lucide-react';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { cn } from '@/lib/utils';

export function WatchlistPanel() {
  const {
    assets,
    prices,
    watchlists,
    selectedAsset,
    setSelectedAsset,
    fetchWatchlists,
    createWatchlist,
    addToWatchlist,
    removeFromWatchlist,
  } = useMarketStore();

  const [activeWatchlistId, setActiveWatchlistId] = useState<string | null>(null);
  const [newWatchlistName, setNewWatchlistName] = useState('');
  const [isCreatingList, setIsCreatingList] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isAddingAsset, setIsAddingAsset] = useState(false);

  useEffect(() => {
    fetchWatchlists();
  }, [fetchWatchlists]);

  // Set default active watchlist
  useEffect(() => {
    if (watchlists.length > 0 && !activeWatchlistId) {
      setActiveWatchlistId(watchlists[0].id);
    }
  }, [watchlists, activeWatchlistId]);

  const activeWatchlist = watchlists.find((wl) => wl.id === activeWatchlistId);

  const handleCreateWatchlist = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWatchlistName.trim()) return;
    await createWatchlist(newWatchlistName.trim());
    setNewWatchlistName('');
    setIsCreatingList(false);
  };

  const handleAddAsset = async (assetId: string) => {
    if (!activeWatchlistId) return;
    await addToWatchlist(activeWatchlistId, assetId);
    setIsAddingAsset(false);
  };

  const handleRemoveAsset = async (assetId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!activeWatchlistId) return;
    await removeFromWatchlist(activeWatchlistId, assetId);
  };

  // Filter assets for add search
  const filteredAssetsToAdd = assets.filter((asset) => {
    const query = searchQuery.toLowerCase();
    const isMatched = asset.symbol.toLowerCase().includes(query) || asset.name.toLowerCase().includes(query);
    // Exclude if already in watchlist
    const isAlreadyAdded = activeWatchlist?.items.some((item) => item.id === asset.id);
    return isMatched && !isAlreadyAdded;
  });

  return (
    <Card className="flex flex-col h-full bg-zinc-950/40 border-zinc-900/60 overflow-hidden select-none">
      {/* Header */}
      <div className="p-3 border-b border-zinc-900/60 flex items-center justify-between bg-zinc-900/10">
        <div className="flex items-center gap-1.5">
          <Star size={14} className="text-amber-400 shrink-0 fill-amber-400/20" />
          <select
            value={activeWatchlistId || ''}
            onChange={(e) => setActiveWatchlistId(e.target.value)}
            className="bg-transparent text-xs font-bold text-white border-none focus:outline-none cursor-pointer max-w-[120px]"
          >
            {watchlists.length === 0 ? (
              <option value="">No Watchlists</option>
            ) : (
              watchlists.map((wl) => (
                <option key={wl.id} value={wl.id} className="bg-zinc-950 text-white">
                  {wl.name}
                </option>
              ))
            )}
          </select>
        </div>

        <div className="flex gap-1">
          <Button
            size="sm"
            variant="ghost"
            className="p-1 h-6 w-6 text-zinc-400 hover:text-white"
            onClick={() => setIsCreatingList(!isCreatingList)}
          >
            <PlusCircle size={14} />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="p-1 h-6 w-6 text-zinc-400 hover:text-white"
            onClick={() => setIsAddingAsset(!isAddingAsset)}
            disabled={!activeWatchlistId}
          >
            <Plus size={14} />
          </Button>
        </div>
      </div>

      {/* Watchlist Creation Form */}
      {isCreatingList && (
        <form onSubmit={handleCreateWatchlist} className="p-3 border-b border-zinc-900 bg-zinc-900/25 flex gap-2">
          <input
            type="text"
            placeholder="Watchlist Name..."
            value={newWatchlistName}
            onChange={(e) => setNewWatchlistName(e.target.value)}
            className="flex-1 bg-zinc-950 border border-zinc-850 rounded text-xs px-2 py-1 text-white focus:outline-none focus:border-zinc-700 placeholder-zinc-650"
            autoFocus
          />
          <Button type="submit" size="sm" className="h-7 text-[10px] px-2.5">
            Create
          </Button>
        </form>
      )}

      {/* Watchlist Items */}
      <div className="flex-1 overflow-y-auto min-h-0 divide-y divide-zinc-950">
        {activeWatchlist && activeWatchlist.items.length === 0 && !isAddingAsset ? (
          <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
            <Star size={20} className="text-zinc-700 mb-2" />
            <p className="text-xs font-semibold text-zinc-400">Watchlist is Empty</p>
            <span className="text-[10px] text-zinc-600 mt-0.5">Click the "+" icon to add assets.</span>
          </div>
        ) : (
          !isAddingAsset &&
          activeWatchlist?.items.map((item) => {
            const priceData = prices[item.symbol.toUpperCase()];
            const price = priceData ? priceData.price : null;
            const changePct = priceData ? priceData.change_pct : 0;
            const isUp = changePct >= 0;
            const isSelected = selectedAsset?.id === item.id;

            return (
              <div
                key={item.id}
                onClick={() => setSelectedAsset(item)}
                className={cn(
                  'flex items-center justify-between p-3 cursor-pointer transition-colors',
                  isSelected
                    ? 'bg-blue-600/10 border-l-2 border-blue-500 shadow-[inset_4px_0_12px_rgba(59,130,246,0.05)]'
                    : 'bg-transparent hover:bg-white/[0.01]'
                )}
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-white uppercase">{item.symbol}</span>
                    <span className="text-[8px] font-semibold text-zinc-500 uppercase px-1 py-0.25 bg-zinc-900 border border-zinc-850 rounded shrink-0">
                      {item.asset_type}
                    </span>
                  </div>
                  <p className="text-[10px] text-zinc-500 truncate mt-0.5 max-w-[110px]">{item.name}</p>
                </div>

                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <p className="text-xs font-semibold text-zinc-200">
                      {price !== null ? formatPrice(price, item.symbol) : '---'}
                    </p>
                    <p className={cn('text-[10px] font-semibold mt-0.25', isUp ? 'text-emerald-400' : 'text-red-400')}>
                      {formatPercentage(changePct)}
                    </p>
                  </div>
                  <button
                    onClick={(e) => handleRemoveAsset(item.id, e)}
                    className="p-1 text-zinc-650 hover:text-red-400 rounded transition-colors focus:outline-none"
                  >
                    <Trash size={12} />
                  </button>
                </div>
              </div>
            );
          })
        )}

        {/* Add Asset Panel */}
        {isAddingAsset && (
          <div className="flex flex-col h-full bg-zinc-950/20">
            <div className="p-3 border-b border-zinc-900/60 bg-zinc-900/10 relative flex items-center">
              <Search size={12} className="text-zinc-500 absolute left-6" />
              <input
                type="text"
                placeholder="Search symbol/name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-850 rounded-lg pl-8 pr-8 py-1 text-xs text-white focus:outline-none focus:border-zinc-700"
                autoFocus
              />
              <button
                onClick={() => setIsAddingAsset(false)}
                className="absolute right-6 text-[10px] font-bold text-zinc-500 hover:text-white transition-colors focus:outline-none"
              >
                Cancel
              </button>
            </div>

            <div className="flex-1 overflow-y-auto divide-y divide-zinc-950">
              {filteredAssetsToAdd.length === 0 ? (
                <div className="py-8 text-center text-xs text-zinc-500">No matching assets found</div>
              ) : (
                filteredAssetsToAdd.map((asset) => (
                  <div
                    key={asset.id}
                    onClick={() => handleAddAsset(asset.id)}
                    className="flex items-center justify-between p-3 cursor-pointer hover:bg-white/[0.01]"
                  >
                    <div>
                      <p className="text-xs font-bold text-white uppercase">{asset.symbol}</p>
                      <span className="text-[10px] text-zinc-500">{asset.name}</span>
                    </div>
                    <Button size="sm" variant="ghost" className="p-1 text-blue-400 hover:bg-blue-500/10 h-6 w-6">
                      <Plus size={14} />
                    </Button>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}
