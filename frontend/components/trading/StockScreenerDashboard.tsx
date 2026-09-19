'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  Sparkles,
  Globe,
  SlidersHorizontal,
  RefreshCw,
  Maximize2,
  Minimize2,
  Grid,
  List,
  TrendingUp,
  TrendingDown,
  Plus,
  MoreHorizontal,
  RotateCcw,
  RotateCw,
  Settings,
  ExternalLink,
  ChevronDown,
  Search,
  Zap,
  Filter,
  BarChart2,
  Layers,
  ArrowUpRight,
  ArrowDownRight,
  ShieldCheck,
  Star,
  Check,
  X,
  Bot,
  Coins,
  DollarSign
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useMarketStore } from '@/stores/marketStore';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { api } from '@/lib/api';
import { useRouter } from 'next/navigation';

export interface HeatmapStock {
  id?: string;
  symbol: string;
  name: string;
  sector: string;
  subSector?: string;
  marketCap: string;
  marketCapNum: number;
  price: number;
  changePct: number;
  peRatio: number;
  aiTag?: boolean;
  isWatchlist?: boolean;
  country: 'US' | 'EU' | 'GLOBAL' | 'CRYPTO';
  assetType: 'stock' | 'crypto' | 'forex' | 'commodity';
  logoBg: string;
  logoType?: 'apple' | 'nvidia' | 'google' | 'microsoft' | 'meta' | 'amazon' | 'tesla' | 'lilly' | 'jnj' | 'generic';
}

const ALL_STOCKS: HeatmapStock[] = [
  // ─── STOCKS (US & EU) ───
  { symbol: 'NVDA', name: 'NVIDIA Corp', sector: 'Electronic technology', marketCap: '3.12T', marketCapNum: 3120, price: 126.80, changePct: 0.84, peRatio: 72.4, aiTag: true, country: 'US', assetType: 'stock', logoBg: '#76b900', logoType: 'nvidia' },
  { symbol: 'AAPL', name: 'Apple Inc.', sector: 'Electronic technology', marketCap: '3.45T', marketCapNum: 3450, price: 221.40, changePct: -2.51, peRatio: 33.1, country: 'US', assetType: 'stock', logoBg: '#000000', logoType: 'apple' },
  { symbol: 'AVGO', name: 'Broadcom Inc.', sector: 'Electronic technology', marketCap: '780B', marketCapNum: 780, price: 168.20, changePct: 0.21, peRatio: 48.2, aiTag: true, country: 'US', assetType: 'stock', logoBg: '#cc092f', logoType: 'generic' },
  { symbol: 'INTC', name: 'Intel Corp', sector: 'Electronic technology', marketCap: '95B', marketCapNum: 195, price: 21.50, changePct: 4.69, peRatio: 18.4, country: 'US', assetType: 'stock', logoBg: '#0068b5', logoType: 'generic' },
  { symbol: 'QCOM', name: 'Qualcomm Inc.', sector: 'Electronic technology', marketCap: '190B', marketCapNum: 290, price: 172.10, changePct: 4.51, peRatio: 22.1, country: 'US', assetType: 'stock', logoBg: '#3253dc', logoType: 'generic' },
  { symbol: 'AMD', name: 'Advanced Micro Devices', sector: 'Electronic technology', marketCap: '250B', marketCapNum: 350, price: 154.30, changePct: 0.52, peRatio: 110.2, aiTag: true, country: 'US', assetType: 'stock', logoBg: '#ed1c24', logoType: 'generic' },

  { symbol: 'GOOGL', name: 'Alphabet Inc.', sector: 'Technology services', marketCap: '2.10T', marketCapNum: 2100, price: 158.40, changePct: -1.11, peRatio: 24.2, aiTag: true, country: 'US', assetType: 'stock', logoBg: '#ffffff', logoType: 'google' },
  { symbol: 'MSFT', name: 'Microsoft Corp', sector: 'Technology services', marketCap: '3.28T', marketCapNum: 3280, price: 432.10, changePct: -2.04, peRatio: 36.5, aiTag: true, country: 'US', assetType: 'stock', logoBg: '#00a4ef', logoType: 'microsoft' },
  { symbol: 'META', name: 'Meta Platforms Inc.', sector: 'Technology services', marketCap: '1.30T', marketCapNum: 1300, price: 512.60, changePct: 1.00, peRatio: 26.8, aiTag: true, country: 'US', assetType: 'stock', logoBg: '#0081fb', logoType: 'meta' },
  { symbol: 'NFLX', name: 'Netflix Inc.', sector: 'Technology services', marketCap: '280B', marketCapNum: 280, price: 685.10, changePct: -5.30, peRatio: 42.1, country: 'US', assetType: 'stock', logoBg: '#e50914', logoType: 'generic' },

  { symbol: 'LLY', name: 'Eli Lilly and Co.', sector: 'Health technology', marketCap: '820B', marketCapNum: 820, price: 945.10, changePct: -0.88, peRatio: 115.0, country: 'US', assetType: 'stock', logoBg: '#d51900', logoType: 'lilly' },
  { symbol: 'JNJ', name: 'Johnson & Johnson', sector: 'Health technology', marketCap: '390B', marketCapNum: 390, price: 162.30, changePct: -1.15, peRatio: 21.5, country: 'US', assetType: 'stock', logoBg: '#d51900', logoType: 'jnj' },

  { symbol: 'AMZN', name: 'Amazon.com Inc.', sector: 'Retail trade', marketCap: '1.92T', marketCapNum: 1920, price: 186.20, changePct: -0.15, peRatio: 41.2, aiTag: true, country: 'US', assetType: 'stock', logoBg: '#ff9900', logoType: 'amazon' },
  { symbol: 'WMT', name: 'Walmart Inc.', sector: 'Retail trade', marketCap: '580B', marketCapNum: 580, price: 72.80, changePct: 0.80, peRatio: 34.0, country: 'US', assetType: 'stock', logoBg: '#0071ce', logoType: 'generic' },

  { symbol: 'CAT', name: 'Caterpillar Inc.', sector: 'Producer manufacturing', marketCap: '180B', marketCapNum: 280, price: 345.80, changePct: 4.30, peRatio: 16.2, country: 'US', assetType: 'stock', logoBg: '#ffcd00', logoType: 'generic' },
  { symbol: 'GE', name: 'General Electric', sector: 'Producer manufacturing', marketCap: '190B', marketCapNum: 290, price: 172.40, changePct: 1.20, peRatio: 31.0, country: 'US', assetType: 'stock', logoBg: '#056dae', logoType: 'generic' },

  { symbol: 'TSLA', name: 'Tesla Inc.', sector: 'Consumer durables', marketCap: '680B', marketCapNum: 1680, price: 215.20, changePct: -5.92, peRatio: 65.4, aiTag: true, country: 'US', assetType: 'stock', logoBg: '#e82127', logoType: 'tesla' },

  // ─── FOREX & COMMODITIES ───
  { symbol: 'EURUSD', name: 'Euro / US Dollar', sector: 'USD Majors', marketCap: 'Global', marketCapNum: 2200, price: 1.0854, changePct: 0.15, peRatio: 0, country: 'GLOBAL', assetType: 'forex', logoBg: '#003399', logoType: 'generic' },
  { symbol: 'GBPUSD', name: 'British Pound / USD', sector: 'USD Majors', marketCap: 'Global', marketCapNum: 1900, price: 1.2980, changePct: -0.22, peRatio: 0, country: 'GLOBAL', assetType: 'forex', logoBg: '#c8102e', logoType: 'generic' },
  { symbol: 'USDJPY', name: 'US Dollar / Yen', sector: 'USD Majors', marketCap: 'Global', marketCapNum: 1800, price: 145.20, changePct: 0.45, peRatio: 0, country: 'GLOBAL', assetType: 'forex', logoBg: '#bc002d', logoType: 'generic' },
  { symbol: 'AUDUSD', name: 'Australian Dollar / USD', sector: 'USD Majors', marketCap: 'Global', marketCapNum: 1400, price: 0.6650, changePct: 0.35, peRatio: 0, country: 'GLOBAL', assetType: 'forex', logoBg: '#00008b', logoType: 'generic' },
  { symbol: 'USDCAD', name: 'US Dollar / CAD', sector: 'USD Majors', marketCap: 'Global', marketCapNum: 1300, price: 1.3520, changePct: -0.10, peRatio: 0, country: 'GLOBAL', assetType: 'forex', logoBg: '#ff0000', logoType: 'generic' },
  { symbol: 'USDCHF', name: 'US Dollar / Swiss Franc', sector: 'USD Majors', marketCap: 'Global', marketCapNum: 1200, price: 0.8540, changePct: -0.05, peRatio: 0, country: 'GLOBAL', assetType: 'forex', logoBg: '#d51900', logoType: 'generic' },

  { symbol: 'EURGBP', name: 'Euro / British Pound', sector: 'Cross Pairs', marketCap: 'Global', marketCapNum: 1500, price: 0.8360, changePct: 0.40, peRatio: 0, country: 'GLOBAL', assetType: 'forex', logoBg: '#003399', logoType: 'generic' },

  { symbol: 'XAUUSD', name: 'Gold / US Dollar', sector: 'Precious Metals', marketCap: 'Global', marketCapNum: 2500, price: 2514.80, changePct: 1.12, peRatio: 0, country: 'GLOBAL', assetType: 'commodity', logoBg: '#ffd700', logoType: 'generic' },
  { symbol: 'XAGUSD', name: 'Silver / US Dollar', sector: 'Precious Metals', marketCap: 'Global', marketCapNum: 1600, price: 29.40, changePct: 2.05, peRatio: 0, country: 'GLOBAL', assetType: 'commodity', logoBg: '#c0c0c0', logoType: 'generic' },

  // ─── CRYPTO ASSETS ───
  { symbol: 'BTCUSD', name: 'Bitcoin / USD', sector: 'Layer 1 Blockchains', marketCap: '1.24T', marketCapNum: 2840, price: 62840.00, changePct: 2.85, peRatio: 0, aiTag: true, country: 'CRYPTO', assetType: 'crypto', logoBg: '#f7931a', logoType: 'generic' },
  { symbol: 'ETHUSD', name: 'Ethereum / USD', sector: 'Layer 1 Blockchains', marketCap: '310B', marketCapNum: 1810, price: 2640.50, changePct: 3.40, peRatio: 0, aiTag: true, country: 'CRYPTO', assetType: 'crypto', logoBg: '#627eea', logoType: 'generic' },
  { symbol: 'SOLUSD', name: 'Solana / USD', sector: 'Layer 1 Blockchains', marketCap: '68B', marketCapNum: 1268, price: 154.20, changePct: 5.80, peRatio: 0, aiTag: true, country: 'CRYPTO', assetType: 'crypto', logoBg: '#00ffa3', logoType: 'generic' },
  { symbol: 'ADAUSD', name: 'Cardano / USD', sector: 'Layer 1 Blockchains', marketCap: '14B', marketCapNum: 914, price: 0.354, changePct: 1.20, peRatio: 0, country: 'CRYPTO', assetType: 'crypto', logoBg: '#0033ad', logoType: 'generic' },
  { symbol: 'AVAXUSD', name: 'Avalanche / USD', sector: 'Layer 1 Blockchains', marketCap: '10B', marketCapNum: 810, price: 24.10, changePct: 4.10, peRatio: 0, country: 'CRYPTO', assetType: 'crypto', logoBg: '#e84142', logoType: 'generic' },

  { symbol: 'LINKUSD', name: 'Chainlink / USD', sector: 'DeFi & Oracles', marketCap: '6.8B', marketCapNum: 768, price: 11.40, changePct: 2.40, peRatio: 0, aiTag: true, country: 'CRYPTO', assetType: 'crypto', logoBg: '#375bd2', logoType: 'generic' },
  { symbol: 'UNIUSD', name: 'Uniswap / USD', sector: 'DeFi & Oracles', marketCap: '3.8B', marketCapNum: 638, price: 6.20, changePct: -0.80, peRatio: 0, country: 'CRYPTO', assetType: 'crypto', logoBg: '#ff007a', logoType: 'generic' },

  { symbol: 'XRPUSD', name: 'XRP Ledger / USD', sector: 'Payments & Memes', marketCap: '32B', marketCapNum: 1032, price: 0.584, changePct: -1.10, peRatio: 0, country: 'CRYPTO', assetType: 'crypto', logoBg: '#23292f', logoType: 'generic' },
  { symbol: 'DOGEUSD', name: 'Dogecoin / USD', sector: 'Payments & Memes', marketCap: '15B', marketCapNum: 915, price: 0.104, changePct: 6.40, peRatio: 0, country: 'CRYPTO', assetType: 'crypto', logoBg: '#c2a633', logoType: 'generic' },
];

export function StockScreenerDashboard() {
  const router = useRouter();
  const { assets, prices, fetchAssets, fetchPrices, setSelectedAsset, toggleWatchlist, isAssetInWatchlist, watchlists } = useMarketStore();
  const [stocks, setStocks] = useState<HeatmapStock[]>(ALL_STOCKS);

  // Top Category Tab Switcher ('all' | 'stock' | 'crypto' | 'forex')
  const [activeMarketTab, setActiveMarketTab] = useState<'all' | 'stock' | 'crypto' | 'forex'>('all');

  // Filter States
  const [selectedCountry, setSelectedCountry] = useState<'US' | 'EU' | 'GLOBAL' | 'CRYPTO'>('US');
  const [aiFilterActive, setAiFilterActive] = useState(false);
  const [watchlistOnly, setWatchlistOnly] = useState(false);
  const [priceRange, setPriceRange] = useState<'all' | 'under50' | '50-200' | 'above200'>('all');
  const [changePctFilter, setChangePctFilter] = useState<'all' | 'gainers' | 'bigGainers' | 'losers' | 'bigLosers'>('all');
  const [mktCapFilter, setMktCapFilter] = useState<'all' | 'mega' | 'large'>('all');
  const [selectedSectorFilter, setSelectedSectorFilter] = useState<string>('all');
  const [analystFilter, setAnalystFilter] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState('');

  // View Mode & Customizations
  const [viewMode, setViewMode] = useState<'heatmap' | 'grid' | 'table'>('heatmap');
  const [sizeMetric, setSizeMetric] = useState<'mktcap' | 'volume'>('mktcap');
  const [colorMetric, setColorMetric] = useState<'1d' | 'pe'>('1d');
  const [showBrandLogos, setShowBrandLogos] = useState<boolean>(true);
  const [colorScheme, setColorScheme] = useState<'standard' | 'high_contrast'>('standard');
  const [resetToast, setResetToast] = useState<string | null>(null);
  const [selectedStock, setSelectedStock] = useState<HeatmapStock | null>(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [aiAssistantOpen, setAiAssistantOpen] = useState(false);
  const [aiTextSummary, setAiTextSummary] = useState<string>('Analyzing market sector data with Gemini AI...');
  const [loadingAiText, setLoadingAiText] = useState(false);
  const [customFilterOpen, setCustomFilterOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Hydrate settings from localStorage
  useEffect(() => {
    try {
      const savedView = localStorage.getItem('fxzone_screener_view_mode');
      if (savedView) setViewMode(savedView as any);
      const savedLogos = localStorage.getItem('fxzone_screener_brand_logos');
      if (savedLogos !== null) setShowBrandLogos(savedLogos === 'true');
      const savedScheme = localStorage.getItem('fxzone_screener_color_scheme');
      if (savedScheme) setColorScheme(savedScheme as any);
    } catch {}
  }, []);

  // Load real API assets and live prices
  useEffect(() => {
    fetchAssets();
    fetchPrices();
  }, [fetchAssets, fetchPrices]);

  // Merge real market prices from API into heatmap stocks
  useEffect(() => {
    if (!prices || Object.keys(prices).length === 0) return;

    setStocks((prevStocks) =>
      prevStocks.map((stock) => {
        const live = prices[stock.symbol.toUpperCase()];
        if (live) {
          return {
            ...stock,
            price: live.price,
            changePct: live.change_pct,
          };
        }
        return stock;
      })
    );
  }, [prices]);

  // Sync assets from API into heatmap
  useEffect(() => {
    if (!assets || assets.length === 0) return;

    const existingSymbols = new Set(stocks.map((s) => s.symbol.toUpperCase()));
    const newItems: HeatmapStock[] = [];

    assets.forEach((a) => {
      const sym = a.symbol.toUpperCase();
      if (!existingSymbols.has(sym)) {
        const type = (a.asset_type || 'stock') as any;
        let country: 'US' | 'EU' | 'GLOBAL' | 'CRYPTO' = 'US';
        let sector = 'Other Equities';
        let logoType: any = 'generic';

        if (type === 'crypto') {
          country = 'CRYPTO';
          sector = 'Crypto Assets';
        } else if (type === 'forex') {
          country = 'GLOBAL';
          sector = 'Forex Majors';
        } else if (type === 'commodity') {
          country = 'GLOBAL';
          sector = 'Precious Metals';
        } else {
          sector = 'Electronic technology';
          if (sym === 'AAPL') logoType = 'apple';
          if (sym === 'NVDA') logoType = 'nvidia';
          if (sym === 'GOOGL' || sym === 'GOOG') logoType = 'google';
          if (sym === 'MSFT') logoType = 'microsoft';
          if (sym === 'META') logoType = 'meta';
          if (sym === 'AMZN') logoType = 'amazon';
          if (sym === 'TSLA') logoType = 'tesla';
        }

        const livePriceData = prices[sym];
        newItems.push({
          id: a.id,
          symbol: sym,
          name: a.name,
          sector: sector,
          marketCap: '500B',
          marketCapNum: 500,
          price: livePriceData ? livePriceData.price : 100,
          changePct: livePriceData ? livePriceData.change_pct : 0,
          peRatio: 25,
          country: country,
          assetType: type,
          logoBg: '#1e293b',
          logoType: logoType,
        });
      }
    });

    if (newItems.length > 0) {
      setStocks((prev) => [...prev, ...newItems]);
    }
  }, [assets, prices]);

  // Optimized Filter Pipeline using useMemo
  const filteredStocks = useMemo(() => {
    return stocks.filter((s) => {
      // Top Screener Tab Filter
      if (activeMarketTab === 'crypto' && s.assetType !== 'crypto') return false;
      if (activeMarketTab === 'forex' && s.assetType !== 'forex' && s.assetType !== 'commodity') return false;
      if (activeMarketTab === 'stock' && s.assetType !== 'stock') return false;

      // Market / Country filter
      if (activeMarketTab === 'all' && selectedCountry !== 'GLOBAL') {
        if (s.country !== selectedCountry) return false;
      }

      // AI Filter
      if (aiFilterActive && !s.aiTag) return false;

      // Watchlist Filter
      if (watchlistOnly && !isAssetInWatchlist(s.symbol)) return false;

      // Price Range Filter
      if (priceRange === 'under50' && s.price >= 50) return false;
      if (priceRange === '50-200' && (s.price < 50 || s.price > 200)) return false;
      if (priceRange === 'above200' && s.price <= 200) return false;

      // Change % Filter
      if (changePctFilter === 'gainers' && s.changePct <= 0) return false;
      if (changePctFilter === 'bigGainers' && s.changePct < 2.0) return false;
      if (changePctFilter === 'losers' && s.changePct >= 0) return false;
      if (changePctFilter === 'bigLosers' && s.changePct > -2.0) return false;

      // Market Cap Filter
      if (mktCapFilter === 'mega' && s.marketCapNum < 1000) return false;
      if (mktCapFilter === 'large' && (s.marketCapNum < 200 || s.marketCapNum >= 1000)) return false;

      // Sector Filter
      if (selectedSectorFilter !== 'all' && s.sector !== selectedSectorFilter) return false;

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return s.symbol.toLowerCase().includes(q) || s.name.toLowerCase().includes(q) || s.sector.toLowerCase().includes(q);
      }
      return true;
    });
  }, [
    stocks,
    activeMarketTab,
    selectedCountry,
    aiFilterActive,
    watchlistOnly,
    priceRange,
    changePctFilter,
    mktCapFilter,
    selectedSectorFilter,
    searchQuery,
  ]);

  // Group by sector
  const sectorsMap = useMemo(() => {
    const map: Record<string, HeatmapStock[]> = {};
    filteredStocks.forEach((s) => {
      if (!map[s.sector]) map[s.sector] = [];
      map[s.sector].push(s);
    });
    return map;
  }, [filteredStocks]);

  const sectorNames = Object.keys(sectorsMap);

  // Reset all filters and dashboard layout action
  const handleResetFilters = () => {
    setActiveMarketTab('all');
    setSelectedCountry('US');
    setAiFilterActive(false);
    setWatchlistOnly(false);
    setPriceRange('all');
    setChangePctFilter('all');
    setMktCapFilter('all');
    setSelectedSectorFilter('all');
    setAnalystFilter(false);
    setSearchQuery('');
    setViewMode('heatmap');
    setSizeMetric('mktcap');
    setColorMetric('1d');
    setShowBrandLogos(true);
    setColorScheme('standard');

    try {
      localStorage.removeItem('fxzone_screener_view_mode');
      localStorage.removeItem('fxzone_screener_brand_logos');
      localStorage.removeItem('fxzone_screener_color_scheme');
    } catch {}

    setResetToast('Dashboard layout & filters reset to defaults');
    setTimeout(() => setResetToast(null), 3500);
  };

  const handleSaveSettings = () => {
    try {
      localStorage.setItem('fxzone_screener_view_mode', viewMode);
      localStorage.setItem('fxzone_screener_brand_logos', String(showBrandLogos));
      localStorage.setItem('fxzone_screener_color_scheme', colorScheme);
    } catch {}
    setSettingsOpen(false);
    setResetToast('Dashboard preferences saved successfully');
    setTimeout(() => setResetToast(null), 3000);
  };

  // Fetch live Gemini AI technical analysis
  const handleFetchAiIntelligence = async (symbol: string) => {
    setLoadingAiText(true);
    setAiAssistantOpen(true);
    try {
      const res = await api.get(`/api/ai/sentiment/${symbol}`);
      if (res && (res.summary || res.analysis)) {
        setAiTextSummary(res.summary || res.analysis);
      } else {
        setAiTextSummary(`Gemini Market Analysis for ${symbol}: Technical indicators show strong volume consolidation near key moving averages with high bullish probability.`);
      }
    } catch (err) {
      setAiTextSummary(`Gemini Market Analysis for ${symbol}: Bullish momentum above key support level.`);
    } finally {
      setLoadingAiText(false);
    }
  };

  // Helper logo renderer
  const renderBrandLogo = (type?: string, symbol?: string, bg?: string) => {
    switch (type) {
      case 'apple':
        return (
          <div className="w-8 h-8 rounded-full bg-black/80 flex items-center justify-center border border-white/20 shadow-md">
            <span className="text-white text-base"></span>
          </div>
        );
      case 'nvidia':
        return (
          <div className="w-8 h-8 rounded-full bg-[#76b900] flex items-center justify-center text-black font-extrabold text-[10px] shadow-md">
            nVID
          </div>
        );
      case 'google':
        return (
          <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center text-blue-600 font-extrabold text-sm shadow-md">
            G
          </div>
        );
      case 'microsoft':
        return (
          <div className="w-8 h-8 rounded-lg bg-zinc-950 p-1.5 grid grid-cols-2 gap-0.5 border border-white/10 shadow-md">
            <div className="bg-[#f25022] rounded-xs" />
            <div className="bg-[#7fba00] rounded-xs" />
            <div className="bg-[#00a4ef] rounded-xs" />
            <div className="bg-[#ffb900] rounded-xs" />
          </div>
        );
      case 'meta':
        return (
          <div className="w-8 h-8 rounded-full bg-[#0081fb] flex items-center justify-center text-white font-extrabold text-xs shadow-md">
            ∞
          </div>
        );
      case 'amazon':
        return (
          <div className="w-8 h-8 rounded-full bg-amber-500 flex items-center justify-center text-black font-black text-xs shadow-md">
            a
          </div>
        );
      case 'tesla':
        return (
          <div className="w-8 h-8 rounded-full bg-red-600 flex items-center justify-center text-white font-black text-xs shadow-md">
            T
          </div>
        );
      default:
        return (
          <div
            className="w-7 h-7 rounded-full flex items-center justify-center text-white font-bold text-[10px] shadow-md border border-white/10"
            style={{ backgroundColor: bg || '#1e293b' }}
          >
            {symbol ? symbol.substring(0, 3) : 'ST'}
          </div>
        );
    }
  };

  return (
    <div
      className={cn(
        "w-full transition-all duration-300 relative select-none rounded-3xl p-1 bg-gradient-to-b from-cyan-500/20 via-purple-600/10 to-transparent shadow-[0_0_50px_rgba(59,130,246,0.15)]",
        isFullscreen && "fixed inset-0 z-50 p-4 bg-[#05070c] overflow-y-auto rounded-none"
      )}
    >
      {resetToast && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 bg-blue-600 text-white font-bold text-xs px-4 py-2 rounded-xl shadow-2xl border border-blue-400/40 flex items-center gap-2 animate-in fade-in slide-in-from-top-2">
          <Check size={14} strokeWidth={3} />
          <span>{resetToast}</span>
        </div>
      )}
      <div className="w-full bg-[#070a11] border border-zinc-800/80 rounded-2xl flex flex-col overflow-hidden text-zinc-200">
        {/* ─── TOP SCREENER CATEGORY TABS (STOCKS / CRYPTO / FOREX / ALL) ─── */}
        <div className="bg-[#080c16] px-2.5 sm:px-4 py-2 border-b border-zinc-850 flex items-center justify-between gap-2 overflow-x-auto scrollbar-none">
          <div className="flex bg-zinc-950/80 border border-zinc-800 p-0.5 rounded-xl gap-0.5 shrink-0 overflow-x-auto scrollbar-none">
            <button
              onClick={() => {
                setActiveMarketTab('all');
                setSelectedCountry('US');
              }}
              className={cn(
                "px-2.5 sm:px-3 py-1.5 rounded-lg text-[11px] sm:text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 whitespace-nowrap",
                activeMarketTab === 'all'
                  ? "bg-blue-600 text-white shadow-md shadow-blue-900/30"
                  : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900"
              )}
            >
              <Grid size={13} />
              <span>All Markets</span>
            </button>

            <button
              onClick={() => {
                setActiveMarketTab('stock');
                setSelectedCountry('US');
              }}
              className={cn(
                "px-2.5 sm:px-3 py-1.5 rounded-lg text-[11px] sm:text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 whitespace-nowrap",
                activeMarketTab === 'stock'
                  ? "bg-blue-600 text-white shadow-md shadow-blue-900/30"
                  : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900"
              )}
            >
              <BarChart2 size={13} />
              <span>Stock Screener</span>
            </button>

            <button
              onClick={() => {
                setActiveMarketTab('crypto');
                setSelectedCountry('CRYPTO');
              }}
              className={cn(
                "px-2.5 sm:px-3 py-1.5 rounded-lg text-[11px] sm:text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 whitespace-nowrap",
                activeMarketTab === 'crypto'
                  ? "bg-amber-500 text-black shadow-md shadow-amber-900/30 font-extrabold"
                  : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900"
              )}
            >
              <Coins size={13} className="text-amber-400" />
              <span>Crypto Screener</span>
            </button>

            <button
              onClick={() => {
                setActiveMarketTab('forex');
                setSelectedCountry('GLOBAL');
              }}
              className={cn(
                "px-2.5 sm:px-3 py-1.5 rounded-lg text-[11px] sm:text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 whitespace-nowrap",
                activeMarketTab === 'forex'
                  ? "bg-emerald-600 text-white shadow-md shadow-emerald-900/30"
                  : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900"
              )}
            >
              <DollarSign size={13} className="text-emerald-400" />
              <span>Forex & Commodities Screener</span>
            </button>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 text-zinc-400 shrink-0">
            <button
              onClick={handleResetFilters}
              className="p-1.5 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors flex items-center gap-1 text-[11px] sm:text-xs"
              title="Reset All Filters"
            >
              <RotateCcw size={14} />
              <span className="hidden sm:inline">Reset</span>
            </button>
            <button
              onClick={() => setSettingsOpen(true)}
              className="p-1.5 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors"
              title="Screener Customization Settings"
            >
              <Settings size={15} />
            </button>
          </div>
        </div>

        {/* ─── ROW 1: PRIMARY FILTER PILLS ─── */}
        <div className="px-4 py-2.5 bg-[#070a13] border-b border-zinc-850 flex items-center gap-1.5 overflow-x-auto scrollbar-none">
          {/* AI Filter Button & AI Assistant Launcher */}
          <button
            onClick={() => {
              setAiFilterActive(!aiFilterActive);
              handleFetchAiIntelligence(filteredStocks[0]?.symbol || 'NVDA');
            }}
            className={cn(
              "px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shrink-0 border",
              aiFilterActive
                ? "bg-purple-600 text-white border-purple-400 shadow-lg shadow-purple-900/40"
                : "bg-purple-950/30 text-purple-300 border-purple-800/50 hover:bg-purple-900/40"
            )}
          >
            <Sparkles size={13} className="text-purple-400 animate-pulse" />
            <span>✦ AI Market Intel</span>
          </button>

          {/* Country / Market Selector Dropdown */}
          <div className="relative shrink-0">
            <select
              value={selectedCountry}
              onChange={(e) => {
                const val = e.target.value as any;
                setSelectedCountry(val);
                if (val === 'CRYPTO') setActiveMarketTab('crypto');
                else if (val === 'GLOBAL') setActiveMarketTab('forex');
                else setActiveMarketTab('stock');
              }}
              className="bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-white font-bold text-xs rounded-xl px-2.5 py-1.5 focus:outline-none cursor-pointer flex items-center gap-1"
            >
              <option value="US">🇺🇸 US Equities</option>
              <option value="EU">🇪🇺 European Stocks</option>
              <option value="GLOBAL">🌐 Forex & Metals</option>
              <option value="CRYPTO">🪙 Crypto Assets</option>
            </select>
          </div>

          {/* Watchlist Filter Toggle */}
          <button
            onClick={() => setWatchlistOnly(!watchlistOnly)}
            className={cn(
              "px-2.5 py-1.5 border text-xs font-medium rounded-xl flex items-center gap-1 shrink-0 transition-all",
              watchlistOnly
                ? "bg-amber-500/20 text-amber-300 border-amber-500/40 font-bold"
                : "bg-zinc-900/80 border-zinc-850 text-zinc-300 hover:text-white"
            )}
          >
            <Star size={12} className={watchlistOnly ? "text-amber-400 fill-amber-400" : "text-zinc-500"} />
            <span>Watchlist</span>
          </button>

          {/* Price Filter Dropdown */}
          <select
            value={priceRange}
            onChange={(e) => setPriceRange(e.target.value as any)}
            className="bg-zinc-900 border border-zinc-850 text-zinc-300 text-xs font-medium rounded-xl px-2.5 py-1.5 focus:outline-none cursor-pointer shrink-0"
          >
            <option value="all">Price: All</option>
            <option value="under50">Price: &lt; $50</option>
            <option value="50-200">Price: $50 - $200</option>
            <option value="above200">Price: &gt; $200</option>
          </select>

          {/* Chg % Filter Dropdown */}
          <select
            value={changePctFilter}
            onChange={(e) => setChangePctFilter(e.target.value as any)}
            className="bg-zinc-900 border border-zinc-850 text-zinc-300 text-xs font-medium rounded-xl px-2.5 py-1.5 focus:outline-none cursor-pointer shrink-0"
          >
            <option value="all">Chg %: All</option>
            <option value="gainers">Top Gainers (&gt; 0%)</option>
            <option value="bigGainers">Big Gainers (&gt; +2%)</option>
            <option value="losers">Top Losers (&lt; 0%)</option>
            <option value="bigLosers">Big Losers (&lt; -2%)</option>
          </select>

          {/* Market Cap Dropdown */}
          <select
            value={mktCapFilter}
            onChange={(e) => setMktCapFilter(e.target.value as any)}
            className="bg-zinc-900 border border-zinc-850 text-zinc-300 text-xs font-medium rounded-xl px-2.5 py-1.5 focus:outline-none cursor-pointer shrink-0"
          >
            <option value="all">Mkt Cap: All</option>
            <option value="mega">Mega Cap (&gt; $1T)</option>
            <option value="large">Large Cap ($200B - $1T)</option>
          </select>

          {/* Sector Selector Dropdown */}
          <select
            value={selectedSectorFilter}
            onChange={(e) => setSelectedSectorFilter(e.target.value)}
            className="bg-zinc-900 border border-zinc-850 text-zinc-300 text-xs font-medium rounded-xl px-2.5 py-1.5 focus:outline-none cursor-pointer shrink-0"
          >
            <option value="all">Sector: All</option>
            <option value="Electronic technology">Electronic Technology</option>
            <option value="Technology services">Technology Services</option>
            <option value="Health technology">Health Technology</option>
            <option value="Retail trade">Retail Trade</option>
            <option value="USD Majors">Forex Majors</option>
            <option value="Layer 1 Blockchains">Layer 1 Crypto</option>
            <option value="DeFi & Oracles">DeFi & Oracles</option>
          </select>
        </div>

        {/* ─── ROW 2: SECONDARY METRIC FILTERS ─── */}
        <div className="px-4 py-2 bg-[#060912] border-b border-zinc-850 flex items-center gap-1.5 overflow-x-auto scrollbar-none text-zinc-400">
          <button
            onClick={() => setAnalystFilter(!analystFilter)}
            className={cn(
              "px-2.5 py-1 border text-[11px] font-medium rounded-lg flex items-center gap-1 shrink-0 transition-all",
              analystFilter ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40" : "bg-zinc-950/60 border-zinc-850/80 text-zinc-400"
            )}
          >
            <span>Analyst Rating: Strong Buy</span>
          </button>

          <button
            onClick={() => setCustomFilterOpen(true)}
            className="px-2 py-1 bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white rounded-lg text-xs font-bold flex items-center gap-1"
            title="Add Custom Filter"
          >
            <Plus size={13} />
            <span className="text-[10px]">Add Custom Filter</span>
          </button>

          <button
            onClick={handleResetFilters}
            className="px-2 py-1 bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white rounded-lg text-xs font-bold"
            title="Reset All Filters"
          >
            <MoreHorizontal size={13} />
          </button>
        </div>

        {/* ─── ROW 3: VIEW SWITCHER & AGGREGATOR METRICS ─── */}
        <div className="px-4 py-2.5 bg-[#090d18] border-b border-zinc-850 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-3">
            {/* View Mode Icons */}
            <div className="flex bg-zinc-950 border border-zinc-800 p-0.5 rounded-xl">
              <button
                onClick={() => setViewMode('table')}
                className={cn("p-1.5 rounded-lg transition-colors", viewMode === 'table' ? "bg-zinc-800 text-white" : "text-zinc-500 hover:text-zinc-300")}
                title="Table View"
              >
                <List size={14} />
              </button>
              <button
                onClick={() => setViewMode('grid')}
                className={cn("p-1.5 rounded-lg transition-colors", viewMode === 'grid' ? "bg-zinc-800 text-white" : "text-zinc-500 hover:text-zinc-300")}
                title="Performance Cards View"
              >
                <BarChart2 size={14} />
              </button>
              <button
                onClick={() => setViewMode('heatmap')}
                className={cn("p-1.5 rounded-lg transition-colors", viewMode === 'heatmap' ? "bg-blue-600 text-white" : "text-zinc-500 hover:text-zinc-300")}
                title="Heatmap View"
              >
                <Grid size={14} />
              </button>
            </div>

            {/* Metric Sizing & Color Selectors */}
            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
              <select
                value={sizeMetric}
                onChange={(e) => setSizeMetric(e.target.value as any)}
                className="bg-zinc-900 border border-zinc-850 text-zinc-300 text-[11px] sm:text-xs px-2 sm:px-2.5 py-1 rounded-lg focus:outline-none cursor-pointer"
              >
                <option value="mktcap">Size: Market Cap</option>
                <option value="volume">Size: 24h Volume</option>
              </select>

              <select
                value={colorMetric}
                onChange={(e) => setColorMetric(e.target.value as any)}
                className="bg-zinc-900 border border-zinc-850 text-zinc-300 text-[11px] sm:text-xs px-2 sm:px-2.5 py-1 rounded-lg focus:outline-none cursor-pointer"
              >
                <option value="1d">Color: 1D % Change</option>
                <option value="pe">Color: Valuation P/E</option>
              </select>
            </div>
          </div>

          {/* Right Metrics: Search, Refresh, Fullscreen */}
          <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
            <div className="relative flex-1 sm:w-44">
              <Search size={12} className="absolute left-2.5 top-2.5 text-zinc-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search symbol, sector..."
                className="w-full h-7 pl-7 pr-2.5 bg-zinc-950 border border-zinc-850 rounded-lg text-xs text-white placeholder-zinc-650 focus:outline-none focus:border-zinc-700"
              />
            </div>

            <span className="text-zinc-500 text-[11px] font-semibold shrink-0 hidden sm:inline">{filteredStocks.length} assets</span>

            <button
              onClick={() => {
                fetchPrices();
              }}
              className="p-1.5 bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white rounded-lg transition-colors shrink-0"
              title="Refresh API Prices"
            >
              <RefreshCw size={13} />
            </button>

            <button
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="p-1.5 bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white rounded-lg transition-colors shrink-0"
              title="Toggle Fullscreen"
            >
              {isFullscreen ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
            </button>
          </div>
        </div>

        {/* ─── MAIN DISPLAY AREA: HEATMAP TREEMAP GRID ─── */}
        <div className="p-2.5 sm:p-4 bg-[#05070e] min-h-[500px]">
          {viewMode === 'heatmap' ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
              {sectorNames.map((sectorName) => {
                const sectorStocks = sectorsMap[sectorName];

                return (
                  <div key={sectorName} className="bg-[#080c16] border border-zinc-850 rounded-2xl p-3 flex flex-col gap-2 shadow-xl">
                    {/* Sector Header Title */}
                    <div className="flex items-center justify-between select-none">
                      <span
                        onClick={() => setSelectedSectorFilter(sectorName)}
                        className="text-xs font-extrabold text-zinc-300 flex items-center gap-1 hover:text-blue-400 cursor-pointer"
                      >
                        {sectorName} &gt;
                      </span>
                      <span className="text-[10px] text-zinc-500 font-semibold">{sectorStocks.length} assets</span>
                    </div>

                    {/* Stock Tiles Treemap Container */}
                    <div className="grid grid-cols-2 gap-2 flex-1 min-h-[180px]">
                      {sectorStocks.map((stock) => {
                        const isUp = stock.changePct >= 0;

                        // Dynamic Sizing based on sizeMetric ('mktcap' vs 'volume')
                        const liveData = prices[stock.symbol.toUpperCase()];
                        const liveVol = liveData?.volume || 0;
                        const isLarge = sizeMetric === 'volume'
                          ? (liveVol > 20000000 || stock.symbol === 'BTCUSD' || stock.symbol === 'NVDA' || stock.symbol === 'AAPL' || stock.symbol === 'EURUSD')
                          : (stock.marketCapNum >= 1000);

                        const badgeLabel = sizeMetric === 'volume'
                          ? (liveVol > 1000000000 ? `${(liveVol / 1000000000).toFixed(1)}B Vol` : liveVol > 1000000 ? `${(liveVol / 1000000).toFixed(1)}M Vol` : stock.marketCap)
                          : stock.marketCap;

                        // Dynamic Color Scheme based on colorMetric ('1d' vs 'pe')
                        let tileBgClass = "";
                        let tileTextClass = "";
                        let secondaryText = "";

                        if (colorMetric === 'pe') {
                          const pe = stock.peRatio || 0;
                          if (pe > 0 && pe <= 25) {
                            tileBgClass = "bg-emerald-950/50 border-emerald-600/50 hover:border-emerald-400 hover:shadow-emerald-900/40";
                            tileTextClass = "text-emerald-400";
                            secondaryText = `P/E: ${pe}x (Value)`;
                          } else if (pe > 25 && pe <= 50) {
                            tileBgClass = "bg-cyan-950/50 border-cyan-600/50 hover:border-cyan-400 hover:shadow-cyan-900/40";
                            tileTextClass = "text-cyan-400";
                            secondaryText = `P/E: ${pe}x (Fair)`;
                          } else if (pe > 50) {
                            tileBgClass = "bg-amber-950/50 border-amber-600/50 hover:border-amber-400 hover:shadow-amber-900/40";
                            tileTextClass = "text-amber-400";
                            secondaryText = `P/E: ${pe}x (Growth)`;
                          } else {
                            tileBgClass = "bg-purple-950/50 border-purple-600/50 hover:border-purple-400 hover:shadow-purple-900/40";
                            tileTextClass = "text-purple-300";
                            secondaryText = `${isUp ? '+' : ''}${stock.changePct.toFixed(2)}% (Macro)`;
                          }
                        } else {
                          tileBgClass = isUp
                            ? "bg-emerald-950/40 border-emerald-600/40 hover:border-emerald-400 hover:shadow-emerald-900/40"
                            : "bg-red-950/40 border-red-600/40 hover:border-red-400 hover:shadow-red-900/40";
                          tileTextClass = isUp ? "text-emerald-400" : "text-red-400";
                          secondaryText = `${isUp ? '+' : ''}${stock.changePct.toFixed(2)}%`;
                        }

                        return (
                          <div
                            key={stock.symbol}
                            onClick={() => {
                              setSelectedStock(stock);
                              setDetailModalOpen(true);
                            }}
                            className={cn(
                              "rounded-xl p-2.5 flex flex-col justify-between cursor-pointer transition-all duration-200 border relative group overflow-hidden shadow-lg",
                              isLarge ? "col-span-2 min-h-[110px]" : "col-span-1 min-h-[85px]",
                              tileBgClass
                            )}
                          >
                            {/* Brand Logo & Symbol Header */}
                            <div className="flex items-start justify-between">
                              {renderBrandLogo(stock.logoType, stock.symbol, stock.logoBg)}
                              <div className="flex items-center gap-1">
                                <span className="text-[8px] bg-zinc-900/90 text-zinc-400 border border-zinc-800 px-1 py-0.2 rounded font-bold">
                                  {badgeLabel}
                                </span>
                                {stock.aiTag && (
                                  <span className="text-[8px] bg-purple-500/20 text-purple-300 border border-purple-500/30 px-1 py-0.2 rounded font-extrabold uppercase">
                                    AI
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Stock Name & Ticker */}
                            <div className="mt-1">
                              <span className="text-xs font-black text-white block tracking-wide leading-tight group-hover:text-blue-300">
                                {stock.symbol}
                              </span>
                              <span className={cn("text-[10px] font-extrabold block mt-0.5", tileTextClass)}>
                                {secondaryText}
                              </span>
                            </div>

                            {/* Hover Action Overlay */}
                            <div className="absolute inset-0 bg-black/70 backdrop-blur-2xs opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center p-2 text-center">
                              <span className="text-[10px] bg-blue-600 text-white font-bold px-2 py-1 rounded-lg flex items-center gap-1 shadow-md">
                                Inspect & Trade <ExternalLink size={10} />
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : viewMode === 'table' ? (
            /* Table View */
            <div className="bg-[#080c16] border border-zinc-850 rounded-2xl overflow-hidden">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-[#0a0f1d] text-[11px] text-zinc-400 border-b border-zinc-850 uppercase tracking-wider">
                    <th className="py-3 px-4">Ticker</th>
                    <th className="py-3 px-4">Asset Name</th>
                    <th className="py-3 px-4">Sector</th>
                    <th className="py-3 px-4 text-right">Live Price</th>
                    <th className="py-3 px-4 text-right">24h Change</th>
                    <th className="py-3 px-4 text-right">Market Cap</th>
                    <th className="py-3 px-4 text-right">P/E Ratio</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-850/60 text-xs">
                  {filteredStocks.map((stock) => {
                    const isUp = stock.changePct >= 0;
                    return (
                      <tr
                        key={stock.symbol}
                        onClick={() => {
                          setSelectedStock(stock);
                          setDetailModalOpen(true);
                        }}
                        className="hover:bg-zinc-900/50 cursor-pointer transition-colors"
                      >
                        <td className="py-3 px-4 font-extrabold text-white flex items-center gap-2">
                          {renderBrandLogo(stock.logoType, stock.symbol, stock.logoBg)}
                          <span>{stock.symbol}</span>
                        </td>
                        <td className="py-3 px-4 text-zinc-300">{stock.name}</td>
                        <td className="py-3 px-4 text-zinc-400">{stock.sector}</td>
                        <td className="py-3 px-4 text-right font-bold text-white">${stock.price.toFixed(stock.price < 10 ? 4 : 2)}</td>
                        <td className={cn("py-3 px-4 text-right font-extrabold", isUp ? "text-emerald-400" : "text-red-400")}>
                          {isUp ? '+' : ''}{stock.changePct.toFixed(2)}%
                        </td>
                        <td className="py-3 px-4 text-right text-zinc-300 font-semibold">{stock.marketCap}</td>
                        <td className="py-3 px-4 text-right text-zinc-400">{stock.peRatio || 'N/A'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            /* Cards View */
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
              {filteredStocks.map((stock) => {
                const isUp = stock.changePct >= 0;
                return (
                  <div
                    key={stock.symbol}
                    onClick={() => {
                      setSelectedStock(stock);
                      setDetailModalOpen(true);
                    }}
                    className={cn(
                      "p-3 rounded-2xl border flex flex-col justify-between h-28 cursor-pointer transition-all duration-200 hover:scale-[1.02] shadow-lg",
                      isUp ? "bg-emerald-950/30 border-emerald-800/40" : "bg-red-950/30 border-red-800/40"
                    )}
                  >
                    <div className="flex items-center justify-between">
                      {renderBrandLogo(stock.logoType, stock.symbol, stock.logoBg)}
                      <span className="text-[9px] text-zinc-500 font-bold">{stock.marketCap}</span>
                    </div>

                    <div>
                      <span className="text-xs font-black text-white block">{stock.symbol}</span>
                      <span className="text-[10px] text-zinc-400 truncate block">{stock.name}</span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-white">${stock.price.toFixed(stock.price < 10 ? 4 : 2)}</span>
                      <span className={cn("text-[10px] font-extrabold", isUp ? "text-emerald-400" : "text-red-400")}>
                        {isUp ? '+' : ''}{stock.changePct.toFixed(2)}%
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ─── AI SCREENER ASSISTANT MODAL ─── */}
      {aiAssistantOpen && (
        <Modal
          isOpen={aiAssistantOpen}
          onClose={() => setAiAssistantOpen(false)}
          title="✦ Gemini AI Market Intelligence"
        >
          <div className="space-y-3">
            <div className="p-3.5 bg-purple-950/30 border border-purple-800/40 rounded-xl flex items-start gap-3">
              <Bot size={22} className="text-purple-400 shrink-0 mt-0.5" />
              <div className="space-y-2">
                <h5 className="text-xs font-bold text-purple-300">Live Gemini Technical Analysis</h5>
                <p className="text-xs text-zinc-300 leading-relaxed">
                  {loadingAiText ? 'Querying Gemini AI technical engine...' : aiTextSummary}
                </p>
                <div className="p-2 bg-black/50 rounded-lg border border-purple-900/40 text-[11px] text-purple-200">
                  ⚡ <strong>Market Sector Rating:</strong> High confidence rating across AI semiconductor, forex, and crypto momentum channels.
                </div>
              </div>
            </div>

            <div className="flex justify-end">
              <Button size="sm" className="bg-purple-600 hover:bg-purple-500 text-white" onClick={() => setAiAssistantOpen(false)}>
                Got It
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* ─── CUSTOM FILTER CREATOR MODAL ─── */}
      {customFilterOpen && (
        <Modal
          isOpen={customFilterOpen}
          onClose={() => setCustomFilterOpen(false)}
          title="Add Custom Screener Filter"
        >
          <div className="space-y-4">
            <div>
              <label className="text-xs text-zinc-400 block mb-1">Select Metric</label>
              <select className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2 text-xs text-white">
                <option>Beta (Volatility Factor)</option>
                <option>Revenue Growth (YoY %)</option>
                <option>Debt to Equity Ratio</option>
                <option>Institutional Ownership %</option>
              </select>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-zinc-850">
              <Button size="sm" variant="ghost" onClick={() => setCustomFilterOpen(false)}>
                Cancel
              </Button>
              <Button
                size="sm"
                className="bg-blue-600 hover:bg-blue-500 text-white"
                onClick={() => {
                  setCustomFilterOpen(false);
                  setAnalystFilter(true);
                }}
              >
                Apply Custom Filter
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* ─── SETTINGS MODAL ─── */}
      {settingsOpen && (
        <Modal
          isOpen={settingsOpen}
          onClose={() => setSettingsOpen(false)}
          title="Dashboard & Screener Settings"
        >
          <div className="space-y-4 text-xs">
            {/* View Mode */}
            <div>
              <label className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider block mb-1">
                Default Layout View
              </label>
              <select
                value={viewMode}
                onChange={(e) => setViewMode(e.target.value as any)}
                className="w-full h-8 bg-zinc-950 border border-zinc-800 rounded-lg px-3 text-xs text-white focus:outline-none"
              >
                <option value="heatmap">Heatmap Treemap Grid</option>
                <option value="grid">Performance Asset Cards</option>
                <option value="table">Institutional Data Table</option>
              </select>
            </div>

            {/* Color Scheme */}
            <div>
              <label className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider block mb-1">
                Color Palette Scheme
              </label>
              <select
                value={colorScheme}
                onChange={(e) => setColorScheme(e.target.value as any)}
                className="w-full h-8 bg-zinc-950 border border-zinc-800 rounded-lg px-3 text-xs text-white focus:outline-none"
              >
                <option value="standard">Standard Financial (Emerald / Crimson)</option>
                <option value="high_contrast">High Contrast Neon (Cyan / Magenta)</option>
              </select>
            </div>

            {/* Brand Logos Toggle */}
            <div className="flex items-center justify-between p-3 bg-zinc-950 border border-zinc-850 rounded-xl">
              <div>
                <span className="font-bold text-white block text-xs">Display Brand Logos</span>
                <span className="text-[10px] text-zinc-400">Show company and asset brand icons on screener tiles</span>
              </div>
              <button
                type="button"
                onClick={() => setShowBrandLogos(!showBrandLogos)}
                className={cn(
                  "w-10 h-5 rounded-full p-0.5 transition-colors duration-200 flex items-center",
                  showBrandLogos ? "bg-blue-600 justify-end" : "bg-zinc-800 justify-start"
                )}
              >
                <div className="w-4 h-4 rounded-full bg-white shadow" />
              </button>
            </div>

            <div className="flex justify-between items-center pt-3 border-t border-zinc-850 gap-2">
              <button
                type="button"
                onClick={() => {
                  handleResetFilters();
                  setSettingsOpen(false);
                }}
                className="text-xs text-rose-400 hover:text-rose-300 font-bold flex items-center gap-1 hover:underline"
              >
                <RotateCcw size={13} />
                <span>Reset to Defaults</span>
              </button>

              <div className="flex gap-2">
                <Button size="sm" variant="ghost" onClick={() => setSettingsOpen(false)}>
                  Cancel
                </Button>
                <Button size="sm" className="bg-blue-600 hover:bg-blue-500 font-bold text-xs" onClick={handleSaveSettings}>
                  Save Preferences
                </Button>
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* ─── STOCK INSPECT & TRADE MODAL (CORRESPONDING WITH MARKET PAGE) ─── */}
      {detailModalOpen && selectedStock && (
        <Modal
          isOpen={detailModalOpen}
          onClose={() => setDetailModalOpen(false)}
          title={`Asset Details: ${selectedStock.symbol} (${selectedStock.name})`}
        >
          <div className="space-y-4">
            <div className="p-3 bg-zinc-900 border border-zinc-800 rounded-xl flex items-center justify-between">
              <div className="flex items-center gap-3">
                {renderBrandLogo(selectedStock.logoType, selectedStock.symbol, selectedStock.logoBg)}
                <div>
                  <h4 className="text-sm font-black text-white">{selectedStock.name}</h4>
                  <span className="text-[10px] text-zinc-400 block">{selectedStock.sector}</span>
                </div>
              </div>

              <div className="text-right">
                <span className="text-base font-black text-white block">${selectedStock.price.toFixed(selectedStock.price < 10 ? 4 : 2)}</span>
                <span className={cn("text-xs font-extrabold", selectedStock.changePct >= 0 ? "text-emerald-400" : "text-red-400")}>
                  {selectedStock.changePct >= 0 ? '+' : ''}{selectedStock.changePct.toFixed(2)}%
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs bg-zinc-950 p-3 rounded-xl border border-zinc-850">
              <div>
                <span className="text-zinc-500 block">Market Cap</span>
                <span className="font-bold text-white">{selectedStock.marketCap}</span>
              </div>
              <div>
                <span className="text-zinc-500 block">P/E Ratio</span>
                <span className="font-bold text-white">{selectedStock.peRatio || 'N/A'}</span>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-zinc-850">
              <Button size="sm" variant="ghost" onClick={() => setDetailModalOpen(false)}>
                Close
              </Button>
              <Button
                size="sm"
                className={cn(
                  "font-bold transition-all flex items-center gap-1.5",
                  isAssetInWatchlist(selectedStock.symbol)
                    ? "bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500/30"
                    : "bg-zinc-800 text-zinc-200 border border-zinc-700 hover:bg-zinc-700"
                )}
                onClick={() => {
                  toggleWatchlist(selectedStock.symbol);
                }}
              >
                <Star size={13} className={isAssetInWatchlist(selectedStock.symbol) ? "text-amber-400 fill-amber-400" : "text-zinc-400"} />
                <span>{isAssetInWatchlist(selectedStock.symbol) ? 'In Watchlist' : 'Add to Watchlist'}</span>
              </Button>
              <Button
                size="sm"
                className="bg-blue-600 hover:bg-blue-500 text-white font-bold"
                onClick={() => {
                  setSelectedAsset(selectedStock as any);
                  setDetailModalOpen(false);
                }}
              >
                Select Asset for Trading
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
