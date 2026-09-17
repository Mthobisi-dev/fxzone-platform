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
  selectedAsset: Asset | null;
  isLoading: boolean;
  error: string | null;

  fetchAssets: (type?: string) => Promise<void>;
  fetchPrices: () => Promise<void>;
  fetchWatchlists: () => Promise<void>;
  createWatchlist: (name: string) => Promise<void>;
  addToWatchlist: (watchlistId: string, assetIdOrSymbol: string) => Promise<void>;
  removeFromWatchlist: (watchlistId: string, assetIdOrSymbol: string) => Promise<void>;
  toggleWatchlist: (asset: Asset | string) => Promise<void>;
  isAssetInWatchlist: (assetIdOrSymbol: string) => boolean;
  setSelectedAsset: (asset: Asset | string) => void;
  updatePrice: (symbol: string, priceData: PriceData) => void;
  updateBulkPrices: (pricesMap: Record<string, PriceData>) => void;
}

const STORAGE_KEY = 'fxzone_user_watchlist_items';

function getStoredWatchlistItems(): Asset[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function setStoredWatchlistItems(items: Asset[]) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    // Ignore storage errors
  }
}

export const useMarketStore = create<MarketState>((set, get) => ({
  assets: [],
  prices: {},
  watchlists: [
    {
      id: 'watchlist-default',
      name: 'My Watchlist',
      items: getStoredWatchlistItems(),
    },
  ],
  selectedAsset: null,
  isLoading: false,
  error: null,

  fetchAssets: async (type) => {
    set({ isLoading: true });
    try {
      const data = await api.get('/api/market/assets', {
        params: type ? { asset_type: type } : {},
      });
      if (Array.isArray(data)) {
        set({ assets: data, isLoading: false });
        if (data.length > 0 && !get().selectedAsset) {
          set({ selectedAsset: data[0] });
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

  fetchWatchlists: async () => {
    try {
      const data = await api.get('/api/market/watchlist');
      if (Array.isArray(data) && data.length > 0) {
        const localItems = getStoredWatchlistItems();
        const mergedItems = [...data[0].items];
        
        localItems.forEach((lItem) => {
          if (!mergedItems.some((m) => m.symbol.toUpperCase() === lItem.symbol.toUpperCase())) {
            mergedItems.push(lItem);
          }
        });

        const updatedWl = [{ id: data[0].id || 'watchlist-default', name: data[0].name || 'My Watchlist', items: mergedItems }];
        set({ watchlists: updatedWl });
        setStoredWatchlistItems(mergedItems);
      }
    } catch (err: any) {
      console.error('Watchlist fetch warning:', err);
    }
  },

  createWatchlist: async (name) => {
    try {
      await api.post('/api/market/watchlist', { name });
      await get().fetchWatchlists();
    } catch (err: any) {
      console.error('Watchlist creation failed:', err);
    }
  },

  addToWatchlist: async (watchlistId, assetIdOrSymbol) => {
    const state = get();
    const assets = state.assets;
    const currentWl = state.watchlists.length > 0 ? state.watchlists[0] : { id: 'watchlist-default', name: 'My Watchlist', items: [] };

    // Find asset object from symbol or id
    const foundAsset = assets.find(
      (a) => a.id === assetIdOrSymbol || a.symbol.toUpperCase() === String(assetIdOrSymbol).toUpperCase()
    ) || {
      id: String(assetIdOrSymbol).toLowerCase(),
      symbol: String(assetIdOrSymbol).toUpperCase(),
      name: String(assetIdOrSymbol).toUpperCase(),
      asset_type: 'stock',
      is_active: true,
    };

    if (!currentWl.items.some((i) => i.symbol.toUpperCase() === foundAsset.symbol.toUpperCase())) {
      const newItems = [...currentWl.items, foundAsset];
      const newWl = [{ ...currentWl, items: newItems }];
      set({ watchlists: newWl });
      setStoredWatchlistItems(newItems);
    }

    try {
      await api.post(`/api/market/watchlist/${watchlistId || 'watchlist-default'}/items`, { asset_id: foundAsset.id, symbol: foundAsset.symbol });
    } catch (err: any) {
      console.warn('Watchlist API sync notice:', err);
    }
  },

  removeFromWatchlist: async (watchlistId, assetIdOrSymbol) => {
    const state = get();
    const currentWl = state.watchlists.length > 0 ? state.watchlists[0] : { id: 'watchlist-default', name: 'My Watchlist', items: [] };

    const newItems = currentWl.items.filter(
      (i) => i.id !== assetIdOrSymbol && i.symbol.toUpperCase() !== String(assetIdOrSymbol).toUpperCase()
    );

    const newWl = [{ ...currentWl, items: newItems }];
    set({ watchlists: newWl });
    setStoredWatchlistItems(newItems);

    try {
      await api.delete(`/api/market/watchlist/${watchlistId || 'watchlist-default'}/items/${assetIdOrSymbol}`);
    } catch (err: any) {
      console.warn('Watchlist API remove notice:', err);
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
    return watchlists[0].items.some((item) => item.id === assetIdOrSymbol || item.symbol.toUpperCase() === target);
  },

  setSelectedAsset: (asset) => {
    if (typeof asset === 'string') {
      const found = get().assets.find((a) => a.symbol.toUpperCase() === asset.toUpperCase());
      if (found) {
        set({ selectedAsset: found });
      }
    } else {
      set({ selectedAsset: asset });
    }
  },

  updatePrice: (symbol, priceData) => {
    set((state) => ({
      prices: {
        ...state.prices,
        [symbol.toUpperCase()]: priceData,
      },
    }));
  },

  updateBulkPrices: (pricesMap) => {
    set((state) => {
      const newPrices = { ...state.prices };
      Object.entries(pricesMap).forEach(([symbol, data]) => {
        newPrices[symbol.toUpperCase()] = data;
      });
      return { prices: newPrices };
    });
  },
}));
