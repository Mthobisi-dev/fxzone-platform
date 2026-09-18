import { create } from 'zustand';
import { api } from '@/lib/api';

export interface Asset {
  id: string;
  symbol: string;
  name: string;
  asset_type: string;
  description?: string;
  is_active: boolean;
}

export interface PriceData {
  symbol: string;
  price: number;
  change: number;
  change_pct: number;
  bid: number;
  ask: number;
  high: number;
  low: number;
  volume: number;
  open: number;
  timestamp: string;
  version?: number;
}

export interface Watchlist {
  id: string;
  name: string;
  items: Asset[];
}

interface MarketState {
  assets: Asset[];
  prices: Record<string, PriceData>;
  watchlists: Watchlist[];
  selectedAssetId: string | null;
  selectedAsset: Asset | null;
  isLoading: boolean;
  isWatchlistsLoaded: boolean;
  error: string | null;

  fetchAssets: (type?: string) => Promise<void>;
  fetchPrices: () => Promise<void>;
  fetchWatchlists: (force?: boolean) => Promise<void>;
  createWatchlist: (name: string) => Promise<void>;
  addToWatchlist: (watchlistId: string, assetIdOrSymbol: string) => Promise<void>;
  removeFromWatchlist: (watchlistId: string, assetIdOrSymbol: string) => Promise<void>;
  toggleWatchlist: (asset: Asset | string) => Promise<void>;
  isAssetInWatchlist: (assetIdOrSymbol: string) => boolean;
  setSelectedAsset: (asset: Asset | string) => void;
  updatePrice: (symbol: string, priceData: PriceData) => void;
  updateBulkPrices: (pricesMap: Record<string, PriceData>) => void;
  clearWatchlists: () => void;
}

function parseTimestamp(ts?: string | number): number {
  if (!ts) return 0;
  if (typeof ts === 'number') return ts;
  const parsed = new Date(ts).getTime();
  return isNaN(parsed) ? 0 : parsed;
}

export const useMarketStore = create<MarketState>((set, get) => ({
  assets: [],
  prices: {},
  watchlists: [
    {
      id: 'watchlist-default',
      name: 'My Watchlist',
      items: [],
    },
  ],
  selectedAssetId: null,
  selectedAsset: null,
  isLoading: false,
  isWatchlistsLoaded: false,
  error: null,

  fetchAssets: async (type) => {
    set({ isLoading: true });
    try {
      const data = await api.get('/api/market/assets', {
        params: type ? { asset_type: type } : {},
      });
      if (Array.isArray(data)) {
        set({ assets: data, isLoading: false });
        if (data.length > 0 && !get().selectedAssetId) {
          set({ selectedAssetId: data[0].id, selectedAsset: data[0] });
        }
      } else {
        set({ isLoading: false });
      }
    } catch (err: any) {
      set({ error: err?.detail || 'Failed to load assets.', isLoading: false });
    }
  },

  fetchPrices: async () => {
    try {
      const data = await api.get('/api/market/prices');
      if (Array.isArray(data)) {
        const pricesMap: Record<string, PriceData> = {};
        data.forEach((p: any) => {
          if (p && p.symbol) {
            pricesMap[p.symbol.toUpperCase()] = p;
          }
        });
        get().updateBulkPrices(pricesMap);
      }
    } catch (err: any) {
      console.error('Failed to fetch market prices:', err);
    }
  },

  fetchWatchlists: async (force = false) => {
    if (get().isWatchlistsLoaded && !force) return;
    try {
      const data = await api.get('/api/market/watchlist');
      if (Array.isArray(data) && data.length > 0) {
        set({ watchlists: data, isWatchlistsLoaded: true });
      } else {
        set({
          watchlists: [{ id: 'watchlist-default', name: 'My Watchlist', items: [] }],
          isWatchlistsLoaded: true,
        });
      }
    } catch (err: any) {
      console.error('Watchlist fetch notice:', err);
      set({ isWatchlistsLoaded: true });
    }
  },

  clearWatchlists: () => {
    set({
      watchlists: [{ id: 'watchlist-default', name: 'My Watchlist', items: [] }],
      isWatchlistsLoaded: false,
    });
  },

  createWatchlist: async (name) => {
    const previousWatchlists = get().watchlists;
    try {
      const created = await api.post('/api/market/watchlist', { name });
      if (created && created.id) {
        set({ watchlists: [...previousWatchlists, created] });
      } else {
        await get().fetchWatchlists(true);
      }
    } catch (err: any) {
      console.error('Watchlist creation failed:', err);
      set({ watchlists: previousWatchlists });
    }
  },

  addToWatchlist: async (watchlistId, assetIdOrSymbol) => {
    const state = get();
    const previousWatchlists = state.watchlists;
    const currentWl = previousWatchlists.length > 0
      ? previousWatchlists[0]
      : { id: 'watchlist-default', name: 'My Watchlist', items: [] };

    // Resolve asset
    const foundAsset = state.assets.find(
      (a) => a.id === assetIdOrSymbol || a.symbol.toUpperCase() === String(assetIdOrSymbol).toUpperCase()
    ) || {
      id: String(assetIdOrSymbol).toLowerCase(),
      symbol: String(assetIdOrSymbol).toUpperCase(),
      name: String(assetIdOrSymbol).toUpperCase(),
      asset_type: 'stock',
      is_active: true,
    };

    if (currentWl.items.some((i) => i.symbol.toUpperCase() === foundAsset.symbol.toUpperCase())) {
      return;
    }

    const updatedItems = [...currentWl.items, foundAsset];
    const updatedWatchlists = previousWatchlists.map((wl, idx) =>
      idx === 0 ? { ...wl, items: updatedItems } : wl
    );

    // 1. Apply optimistic state
    set({ watchlists: updatedWatchlists });

    // 2. Perform server API call; on failure, refetch authoritative server state to avoid stale rollback races
    try {
      await api.post(`/api/market/watchlist/${watchlistId || currentWl.id}/items`, {
        asset_id: foundAsset.id,
        symbol: foundAsset.symbol,
      });
    } catch (err: any) {
      console.error('Failed to add item to server watchlist. Syncing with server:', err);
      await get().fetchWatchlists(true);
    }
  },

  removeFromWatchlist: async (watchlistId, assetIdOrSymbol) => {
    const state = get();
    const previousWatchlists = state.watchlists;
    const currentWl = previousWatchlists.length > 0
      ? previousWatchlists[0]
      : { id: 'watchlist-default', name: 'My Watchlist', items: [] };

    const updatedItems = currentWl.items.filter(
      (i) => i.id !== assetIdOrSymbol && i.symbol.toUpperCase() !== String(assetIdOrSymbol).toUpperCase()
    );

    const updatedWatchlists = previousWatchlists.map((wl, idx) =>
      idx === 0 ? { ...wl, items: updatedItems } : wl
    );

    // 1. Apply optimistic state
    set({ watchlists: updatedWatchlists });

    // 2. Perform server API call; on failure, refetch authoritative server state to avoid stale rollback races
    try {
      await api.delete(`/api/market/watchlist/${watchlistId || currentWl.id}/items/${assetIdOrSymbol}`);
    } catch (err: any) {
      console.error('Failed to remove item from server watchlist. Syncing with server:', err);
      await get().fetchWatchlists(true);
    }
  },

  toggleWatchlist: async (asset) => {
    const symbolOrId = typeof asset === 'string' ? asset : asset.symbol;
    const state = get();
    const isIn = state.isAssetInWatchlist(symbolOrId);
    const wlId = state.watchlists.length > 0 ? state.watchlists[0].id : 'watchlist-default';

    if (isIn) {
      await state.removeFromWatchlist(wlId, symbolOrId);
    } else {
      await state.addToWatchlist(wlId, symbolOrId);
    }
  },

  isAssetInWatchlist: (assetIdOrSymbol) => {
    const watchlists = get().watchlists;
    if (watchlists.length === 0) return false;
    const target = String(assetIdOrSymbol).toUpperCase();
    return watchlists[0].items.some(
      (item) => item.id === assetIdOrSymbol || item.symbol.toUpperCase() === target
    );
  },

  setSelectedAsset: (asset) => {
    if (typeof asset === 'string') {
      const found = get().assets.find((a) => a.symbol.toUpperCase() === asset.toUpperCase());
      if (found) {
        set({ selectedAssetId: found.id, selectedAsset: found });
      }
    } else if (asset) {
      set({ selectedAssetId: asset.id, selectedAsset: asset });
    }
  },

  updatePrice: (symbol, priceData) => {
    const upper = symbol.toUpperCase();
    const currentPrices = get().prices;
    const existing = currentPrices[upper];

    if (existing) {
      const existingTime = parseTimestamp(existing.timestamp);
      const incomingTime = parseTimestamp(priceData.timestamp);
      // Drop stale market data updates that arrived out of order
      if (incomingTime < existingTime) {
        return;
      }
    }

    set((state) => ({
      prices: {
        ...state.prices,
        [upper]: priceData,
      },
    }));
  },

  updateBulkPrices: (pricesMap) => {
    set((state) => {
      const newPrices = { ...state.prices };
      let updated = false;

      Object.entries(pricesMap).forEach(([symbol, incomingData]) => {
        const upper = symbol.toUpperCase();
        const existing = newPrices[upper];

        if (!existing || parseTimestamp(incomingData.timestamp) >= parseTimestamp(existing.timestamp)) {
          newPrices[upper] = incomingData;
          updated = true;
        }
      });

      return updated ? { prices: newPrices } : state;
    });
  },
}));
