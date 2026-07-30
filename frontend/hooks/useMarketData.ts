import { useEffect } from 'react';
import { useMarketStore } from '@/stores/marketStore';
import { FxZoneWebSocket } from '@/lib/websocket';
import { api } from '@/lib/api';

export function useMarketData(symbols: string[] = []) {
  const {
    assets,
    prices,
    watchlists,
    selectedAsset,
    isLoading,
    error,
    fetchAssets,
    fetchWatchlists,
    createWatchlist,
    addToWatchlist,
    removeFromWatchlist,
    setSelectedAsset,
    updatePrice,
    updateBulkPrices,
  } = useMarketStore();

  useEffect(() => {
    if (assets.length === 0 && !isLoading) {
      fetchAssets();
    }
    fetchWatchlists();
  }, [assets.length, fetchAssets, fetchWatchlists, isLoading]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (symbols.length === 0) return;

    // Create a market websocket connection
    const socket = new FxZoneWebSocket('/ws/market');

    socket.on('open', () => {
      // Subscribe to requested symbols
      socket.send({
        action: 'subscribe',
        symbols,
      });
    });

    // Fetch initial prices via HTTP REST API to populate the UI instantly
    const fetchInitialPrices = async () => {
      try {
        const queryParams = symbols.join(',');
        const res = await api.get(`/api/market/prices?symbols=${queryParams}`);
        if (res) {
          updateBulkPrices(res);
        }
      } catch (e) {
        console.error('Failed to fetch initial prices:', e);
      }
    };
    fetchInitialPrices();

    socket.on('prices', (payload: any) => {
      if (payload && payload.data) {
        updateBulkPrices(payload.data);
      }
    });

    socket.on('price_update', (data: any) => {
      // Map incoming socket data to state PriceData interface
      if (data && data.symbol) {
        updatePrice(data.symbol, {
          symbol: data.symbol,
          price: data.price,
          change: data.change,
          change_pct: data.change_pct,
          bid: data.bid,
          ask: data.ask,
          high: data.high,
          low: data.low,
          volume: data.volume,
          open: data.open || data.price,
          timestamp: data.timestamp || new Date().toISOString(),
        });
      }
    });

    socket.connect();

    return () => {
      socket.close();
    };
  }, [JSON.stringify(symbols), updatePrice]);

  return {
    assets,
    prices,
    watchlists,
    selectedAsset,
    isLoading,
    error,
    fetchAssets,
    fetchWatchlists,
    createWatchlist,
    addToWatchlist,
    removeFromWatchlist,
    setSelectedAsset,
  };
}
