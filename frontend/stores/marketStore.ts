import { create } from 'zustand';
import { api } from '@/lib/api';

interface Asset {
  id: string;
  symbol: string;
  name: string;
  asset_type: string;
  description?: string;
  is_active: boolean;
}

interface PriceData {
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

interface Watchlist {
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
  addToWatchlist: (watchlistId: string, assetId: string) => Promise<void>;
  removeFromWatchlist: (watchlistId: string, assetId: string) => Promise<void>;
  setSelectedAsset: (asset: Asset | string) => void;
  updatePrice: (symbol: string, priceData: PriceData) => void;
  updateBulkPrices: (pricesMap: Record<string, PriceData>) => void;
}

export const useMarketStore = create<MarketState>((set, get) => ({
  assets: [],
  prices: {},
  watchlists: [],
  selectedAsset: null,
  isLoading: false,
  error: null,

  fetchAssets: async (type) => {
    set({ isLoading: true });
    try {
      const data = await api.get('/api/market/assets', {
        params: type ? { asset_type: type } : {},
      });
      set({ assets: data, isLoading: false });
      
      // Default select the first asset if none is selected
      if (data.length > 0 && !get().selectedAsset) {
        set({ selectedAsset: data[0] });
      }
    } catch (err: any) {
      set({ error: err.detail || 'Failed to load assets.', isLoading: false });
    }
  },

  fetchPrices: async () => {
    try {
      const data = await api.get('/api/market/prices');
      if (Array.isArray(data)) {
        const pricesMap: Record<string, PriceData> = {};
        data.forEach((p: any) => {
          pricesMap[p.symbol.toUpperCase()] = p;
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
      set({ watchlists: data });
    } catch (err: any) {
      console.error('Watchlist fetch failed:', err);
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

  addToWatchlist: async (watchlistId, assetId) => {
    try {
      await api.post(`/api/market/watchlist/${watchlistId}/items`, { asset_id: assetId });
      await get().fetchWatchlists();
    } catch (err: any) {
      console.error('Add to watchlist failed:', err);
    }
  },

  removeFromWatchlist: async (watchlistId, assetId) => {
    try {
      await api.delete(`/api/market/watchlist/${watchlistId}/items/${assetId}`);
      await get().fetchWatchlists();
    } catch (err: any) {
      console.error('Remove from watchlist failed:', err);
    }
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
