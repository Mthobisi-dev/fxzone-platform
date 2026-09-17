'use client';

import React, { useState, useEffect } from 'react';
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
  Sliders
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useMarketStore } from '@/stores/marketStore';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { api } from '@/lib/api';

export interface HeatmapStock {
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
  logoBg: string;
  logoType?: 'apple' | 'nvidia' | 'google' | 'microsoft' | 'meta' | 'amazon' | 'tesla' | 'lilly' | 'jnj' | 'generic';
}

const ALL_STOCKS: HeatmapStock[] = [
  // ─── US STOCKS ───
  { symbol: 'NVDA', name: 'NVIDIA Corp', sector: 'Electronic technology', marketCap: '3.12T', marketCapNum: 3120, price: 126.80, changePct: 0.84, peRatio: 72.4, aiTag: true, country: 'US', logoBg: '#76b900', logoType: 'nvidia' },
  { symbol: 'AAPL', name: 'Apple Inc.', sector: 'Electronic technology', marketCap: '3.45T', marketCapNum: 3450, price: 221.40, changePct: -2.51, peRatio: 33.1, country: 'US', logoBg: '#000000', logoType: 'apple' },
  { symbol: 'AVGO', name: 'Broadcom Inc.', sector: 'Electronic technology', marketCap: '780B', marketCapNum: 780, price: 168.20, changePct: 0.21, peRatio: 48.2, aiTag: true, country: 'US', logoBg: '#cc092f', logoType: 'generic' },
  { symbol: 'INTC', name: 'Intel Corp', sector: 'Electronic technology', marketCap: '95B', marketCapNum: 195, price: 21.50, changePct: 4.69, peRatio: 18.4, country: 'US', logoBg: '#0068b5', logoType: 'generic' },
  { symbol: 'QCOM', name: 'Qualcomm Inc.', sector: 'Electronic technology', marketCap: '190B', marketCapNum: 290, price: 172.10, changePct: 4.51, peRatio: 22.1, country: 'US', logoBg: '#3253dc', logoType: 'generic' },
  { symbol: 'AMD', name: 'Advanced Micro Devices', sector: 'Electronic technology', marketCap: '250B', marketCapNum: 350, price: 154.30, changePct: 0.52, peRatio: 110.2, aiTag: true, country: 'US', logoBg: '#ed1c24', logoType: 'generic' },

  { symbol: 'GOOG', name: 'Alphabet Inc.', sector: 'Technology services', marketCap: '2.10T', marketCapNum: 2100, price: 158.40, changePct: -1.11, peRatio: 24.2, aiTag: true, country: 'US', logoBg: '#ffffff', logoType: 'google' },
  { symbol: 'MSFT', name: 'Microsoft Corp', sector: 'Technology services', marketCap: '3.28T', marketCapNum: 3280, price: 432.10, changePct: -2.04, peRatio: 36.5, aiTag: true, country: 'US', logoBg: '#00a4ef', logoType: 'microsoft' },
  { symbol: 'META', name: 'Meta Platforms Inc.', sector: 'Technology services', marketCap: '1.30T', marketCapNum: 1300, price: 512.60, changePct: 1.00, peRatio: 26.8, aiTag: true, country: 'US', logoBg: '#0081fb', logoType: 'meta' },
  { symbol: 'NFLX', name: 'Netflix Inc.', sector: 'Technology services', marketCap: '280B', marketCapNum: 280, price: 685.10, changePct: -5.30, peRatio: 42.1, country: 'US', logoBg: '#e50914', logoType: 'generic' },
  { symbol: 'ADBE', name: 'Adobe Inc.', sector: 'Technology services', marketCap: '240B', marketCapNum: 240, price: 540.20, changePct: 0.40, peRatio: 46.3, country: 'US', logoBg: '#ff0000', logoType: 'generic' },
  { symbol: 'ORCL', name: 'Oracle Corp', sector: 'Technology services', marketCap: '380B', marketCapNum: 380, price: 142.10, changePct: 3.20, peRatio: 38.1, country: 'US', logoBg: '#f80000', logoType: 'generic' },

  { symbol: 'LLY', name: 'Eli Lilly and Co.', sector: 'Health technology', marketCap: '820B', marketCapNum: 820, price: 945.10, changePct: -0.88, peRatio: 115.0, country: 'US', logoBg: '#d51900', logoType: 'lilly' },
  { symbol: 'JNJ', name: 'Johnson & Johnson', sector: 'Health technology', marketCap: '390B', marketCapNum: 390, price: 162.30, changePct: -1.15, peRatio: 21.5, country: 'US', logoBg: '#d51900', logoType: 'jnj' },
  { symbol: 'PFE', name: 'Pfizer Inc.', sector: 'Health technology', marketCap: '160B', marketCapNum: 260, price: 28.40, changePct: -1.50, peRatio: 15.2, country: 'US', logoBg: '#0093d0', logoType: 'generic' },
  { symbol: 'UNH', name: 'UnitedHealth Group', sector: 'Health technology', marketCap: '530B', marketCapNum: 530, price: 582.40, changePct: -0.40, peRatio: 28.1, country: 'US', logoBg: '#002677', logoType: 'generic' },

  { symbol: 'AMZN', name: 'Amazon.com Inc.', sector: 'Retail trade', marketCap: '1.92T', marketCapNum: 1920, price: 186.20, changePct: -0.15, peRatio: 41.2, aiTag: true, country: 'US', logoBg: '#ff9900', logoType: 'amazon' },
  { symbol: 'WMT', name: 'Walmart Inc.', sector: 'Retail trade', marketCap: '580B', marketCapNum: 580, price: 72.80, changePct: 0.80, peRatio: 34.0, country: 'US', logoBg: '#0071ce', logoType: 'generic' },
  { symbol: 'COST', name: 'Costco Wholesale', sector: 'Retail trade', marketCap: '380B', marketCapNum: 380, price: 865.10, changePct: 1.10, peRatio: 52.3, country: 'US', logoBg: '#e31837', logoType: 'generic' },

  { symbol: 'CAT', name: 'Caterpillar Inc.', sector: 'Producer manufacturing', marketCap: '180B', marketCapNum: 280, price: 345.80, changePct: 4.30, peRatio: 16.2, country: 'US', logoBg: '#ffcd00', logoType: 'generic' },
  { symbol: 'GE', name: 'General Electric', sector: 'Producer manufacturing', marketCap: '190B', marketCapNum: 290, price: 172.40, changePct: 1.20, peRatio: 31.0, country: 'US', logoBg: '#056dae', logoType: 'generic' },

  { symbol: 'SPCX', name: 'SpaceX Comms', sector: 'Communications', marketCap: '210B', marketCapNum: 310, price: 185.00, changePct: -1.20, peRatio: 45.0, country: 'US', logoBg: '#000000', logoType: 'generic' },
  { symbol: 'TMUS', name: 'T-Mobile US Inc.', sector: 'Communications', marketCap: '230B', marketCapNum: 330, price: 198.40, changePct: 0.90, peRatio: 24.1, country: 'US', logoBg: '#e20074', logoType: 'generic' },

  { symbol: 'TSLA', name: 'Tesla Inc.', sector: 'Consumer durables', marketCap: '680B', marketCapNum: 1680, price: 215.20, changePct: -5.92, peRatio: 65.4, aiTag: true, country: 'US', logoBg: '#e82127', logoType: 'tesla' },

  { symbol: 'BRK.A', name: 'Berkshire Hathaway', sector: 'Finance', marketCap: '950B', marketCapNum: 950, price: 685000, changePct: -0.48, peRatio: 21.0, country: 'US', logoBg: '#112244', logoType: 'generic' },
  { symbol: 'JPM', name: 'JPMorgan Chase', sector: 'Finance', marketCap: '620B', marketCapNum: 620, price: 214.50, changePct: 0.21, peRatio: 12.4, country: 'US', logoBg: '#0a2240', logoType: 'generic' },
  { symbol: 'V', name: 'Visa Inc.', sector: 'Finance', marketCap: '560B', marketCapNum: 560, price: 278.40, changePct: -0.90, peRatio: 30.1, country: 'US', logoBg: '#1a1f71', logoType: 'generic' },

  { symbol: 'XOM', name: 'Exxon Mobil Corp', sector: 'Energy minerals', marketCap: '480B', marketCapNum: 480, price: 118.20, changePct: -1.69, peRatio: 14.1, country: 'US', logoBg: '#ff0000', logoType: 'generic' },

  // ─── EUROPEAN STOCKS (EU) ───
  { symbol: 'ASML', name: 'ASML Holding NV', sector: 'Electronic technology', marketCap: '350B', marketCapNum: 1350, price: 840.10, changePct: 1.80, peRatio: 42.0, aiTag: true, country: 'EU', logoBg: '#002677', logoType: 'generic' },
  { symbol: 'SAP', name: 'SAP SE', sector: 'Technology services', marketCap: '260B', marketCapNum: 1260, price: 198.50, changePct: 0.95, peRatio: 38.5, country: 'EU', logoBg: '#008fd3', logoType: 'generic' },
  { symbol: 'NVO', name: 'Novo Nordisk A/S', sector: 'Health technology', marketCap: '580B', marketCapNum: 1580, price: 132.40, changePct: 2.10, peRatio: 45.2, country: 'EU', logoBg: '#001965', logoType: 'generic' },
  { symbol: 'SHEL', name: 'Shell PLC', sector: 'Energy minerals', marketCap: '210B', marketCapNum: 1210, price: 34.20, changePct: -0.40, peRatio: 11.2, country: 'EU', logoBg: '#dd1d21', logoType: 'generic' },

  // ─── GLOBAL FOREX & MULTI-ASSETS ───
  { symbol: 'EURUSD', name: 'Euro / US Dollar', sector: 'Forex Majors', marketCap: 'Global', marketCapNum: 2000, price: 1.0854, changePct: 0.15, peRatio: 0, country: 'GLOBAL', logoBg: '#003399', logoType: 'generic' },
  { symbol: 'GBPUSD', name: 'British Pound / USD', sector: 'Forex Majors', marketCap: 'Global', marketCapNum: 1800, price: 1.2980, changePct: -0.22, peRatio: 0, country: 'GLOBAL', logoBg: '#c8102e', logoType: 'generic' },
  { symbol: 'XAUUSD', name: 'Gold / US Dollar', sector: 'Precious Metals', marketCap: 'Global', marketCapNum: 2500, price: 2514.80, changePct: 1.12, peRatio: 0, country: 'GLOBAL', logoBg: '#ffd700', logoType: 'generic' },

  // ─── CRYPTO MARKET ───
  { symbol: 'BTCUSD', name: 'Bitcoin / USD', sector: 'Crypto Assets', marketCap: '1.24T', marketCapNum: 2240, price: 62840.00, changePct: 2.85, peRatio: 0, aiTag: true, country: 'CRYPTO', logoBg: '#f7931a', logoType: 'generic' },
  { symbol: 'ETHUSD', name: 'Ethereum / USD', sector: 'Crypto Assets', marketCap: '310B', marketCapNum: 1310, price: 2640.50, changePct: 3.40, peRatio: 0, aiTag: true, country: 'CRYPTO', logoBg: '#627eea', logoType: 'generic' },
  { symbol: 'SOLUSD', name: 'Solana / USD', sector: 'Crypto Assets', marketCap: '68B', marketCapNum: 968, price: 154.20, changePct: 5.80, peRatio: 0, aiTag: true, country: 'CRYPTO', logoBg: '#00ffa3', logoType: 'generic' },
  { symbol: 'XRPUSD', name: 'XRP Ledger / USD', sector: 'Crypto Assets', marketCap: '32B', marketCapNum: 732, price: 0.584, changePct: -1.10, peRatio: 0, country: 'CRYPTO', logoBg: '#23292f', logoType: 'generic' },
];

export function StockScreenerDashboard() {
  const { setSelectedAsset } = useMarketStore();
  const [stocks, setStocks] = useState<HeatmapStock[]>(ALL_STOCKS);

  // Active Filter States
  const [selectedCountry, setSelectedCountry] = useState<'US' | 'EU' | 'GLOBAL' | 'CRYPTO'>('US');
  const [aiFilterActive, setAiFilterActive] = useState(false);
  const [watchlistOnly, setWatchlistOnly] = useState(false);
  const [indexFilter, setIndexFilter] = useState<'all' | 'sp500' | 'nasdaq100'>('all');
  const [priceRange, setPriceRange] = useState<'all' | 'under50' | '50-200' | 'above200'>('all');
  const [changePctFilter, setChangePctFilter] = useState<'all' | 'gainers' | 'bigGainers' | 'losers' | 'bigLosers'>('all');
  const [mktCapFilter, setMktCapFilter] = useState<'all' | 'mega' | 'large' | 'mid'>('all');
  const [peFilter, setPeFilter] = useState<'all' | 'value' | 'growth'>('all');
  const [selectedSectorFilter, setSelectedSectorFilter] = useState<string>('all');
  const [analystFilter, setAnalystFilter] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState('');

  // History Stack for Undo/Redo
  const [historyStack, setHistoryStack] = useState<any[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);

  // View Mode & Customizations
  const [viewMode, setViewMode] = useState<'heatmap' | 'grid' | 'table'>('heatmap');
  const [sizeMetric, setSizeMetric] = useState<'mktcap' | 'volume'>('mktcap');
  const [colorMetric, setColorMetric] = useState<'1d' | 'pe'>('1d');
  const [selectedStock, setSelectedStock] = useState<HeatmapStock | null>(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [aiAssistantOpen, setAiAssistantOpen] = useState(false);
  const [customFilterOpen, setCustomFilterOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Real-time market tick updates simulation
  useEffect(() => {
    const interval = setInterval(() => {
      setStocks((prev) =>
        prev.map((s) => {
          if (Math.random() > 0.55) {
            const deltaPct = (Math.random() - 0.49) * 0.12;
            const newPct = parseFloat((s.changePct + deltaPct).toFixed(2));
            const newPrice = parseFloat((s.price * (1 + deltaPct / 100)).toFixed(2));
            return { ...s, changePct: newPct, price: newPrice };
          }
          return s;
        })
      );
    }, 3500);

    return () => clearInterval(interval);
  }, []);

  // Filter application pipeline
  const filteredStocks = stocks.filter((s) => {
    // Market / Country filter
    if (s.country !== selectedCountry && selectedCountry !== 'GLOBAL') return false;

    // AI Filter
    if (aiFilterActive && !s.aiTag) return false;

    // Watchlist Filter
    if (watchlistOnly && !s.isWatchlist) return false;

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

    // P/E Ratio Filter
    if (peFilter === 'value' && (s.peRatio <= 0 || s.peRatio > 25)) return false;
    if (peFilter === 'growth' && s.peRatio <= 25) return false;

    // Sector Filter
    if (selectedSectorFilter !== 'all' && s.sector !== selectedSectorFilter) return false;

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return s.symbol.toLowerCase().includes(q) || s.name.toLowerCase().includes(q) || s.sector.toLowerCase().includes(q);
    }
    return true;
  });

  // Group by sector
  const sectorsMap: Record<string, HeatmapStock[]> = {};
  filteredStocks.forEach((s) => {
    if (!sectorsMap[s.sector]) sectorsMap[s.sector] = [];
    sectorsMap[s.sector].push(s);
  });

  const sectorNames = Object.keys(sectorsMap);

  // Reset all filters action
  const handleResetFilters = () => {
    setAiFilterActive(false);
    setWatchlistOnly(false);
    setPriceRange('all');
    setChangePctFilter('all');
    setMktCapFilter('all');
    setPeFilter('all');
    setSelectedSectorFilter('all');
    setAnalystFilter(false);
    setSearchQuery('');
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
            {symbol ? symbol.substring(0, 2) : 'ST'}
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
      <div className="w-full bg-[#070a11] border border-zinc-800/80 rounded-2xl flex flex-col overflow-hidden text-zinc-200">
        {/* ─── TOP CONTROL BAR (TITLE, REFRESH, SETTINGS) ─── */}
        <div className="bg-[#0a0e1a] px-4 py-3 border-b border-zinc-850 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-extrabold text-white flex items-center gap-2">
              Stock Screener <ChevronDown size={16} className="text-zinc-400 cursor-pointer" />
            </h2>
            <span className="text-[10px] bg-blue-600/20 text-blue-400 border border-blue-500/30 px-2 py-0.5 rounded-full font-bold uppercase">
              TradingView Market Feeds
            </span>
          </div>

          <div className="flex items-center gap-2 text-zinc-400">
            <button
              onClick={handleResetFilters}
              className="p-1.5 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors flex items-center gap-1 text-xs"
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
        <div className="px-4 py-2.5 bg-[#080c16] border-b border-zinc-850 flex items-center gap-1.5 overflow-x-auto scrollbar-none">
          {/* AI Filter Button & AI Assistant Launcher */}
          <button
            onClick={() => {
              setAiFilterActive(!aiFilterActive);
              if (!aiFilterActive) setAiAssistantOpen(true);
            }}
            className={cn(
              "px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shrink-0 border",
              aiFilterActive
                ? "bg-purple-600 text-white border-purple-400 shadow-lg shadow-purple-900/40"
                : "bg-purple-950/30 text-purple-300 border-purple-800/50 hover:bg-purple-900/40"
            )}
          >
            <Sparkles size={13} className="text-purple-400 animate-pulse" />
            <span>✦ AI Screener</span>
          </button>

          {/* Country / Market Selector Dropdown */}
          <div className="relative shrink-0">
            <select
              value={selectedCountry}
              onChange={(e) => setSelectedCountry(e.target.value as any)}
              className="bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-white font-bold text-xs rounded-xl px-2.5 py-1.5 focus:outline-none cursor-pointer flex items-center gap-1"
            >
              <option value="US">🇺🇸 US Markets</option>
              <option value="EU">🇪🇺 European Stocks</option>
              <option value="GLOBAL">🌐 Global Multi-Assets</option>
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

          {/* P/E Dropdown */}
          <select
            value={peFilter}
            onChange={(e) => setPeFilter(e.target.value as any)}
            className="bg-zinc-900 border border-zinc-850 text-zinc-300 text-xs font-medium rounded-xl px-2.5 py-1.5 focus:outline-none cursor-pointer shrink-0"
          >
            <option value="all">P/E: All</option>
            <option value="value">Value (P/E &lt; 25)</option>
            <option value="growth">Growth (P/E &gt; 25)</option>
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
            <option value="Producer manufacturing">Producer Manufacturing</option>
            <option value="Communications">Communications</option>
            <option value="Consumer durables">Consumer Durables</option>
            <option value="Finance">Finance</option>
            <option value="Energy minerals">Energy Minerals</option>
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

            {/* Metric Sizing Selectors */}
            <div className="hidden sm:flex items-center gap-2">
              <select
                value={sizeMetric}
                onChange={(e) => setSizeMetric(e.target.value as any)}
                className="bg-zinc-900 border border-zinc-850 text-zinc-300 text-xs px-2.5 py-1 rounded-lg focus:outline-none cursor-pointer"
              >
                <option value="mktcap">Size: Market Cap</option>
                <option value="volume">Size: Volume</option>
              </select>

              <select
                value={colorMetric}
                onChange={(e) => setColorMetric(e.target.value as any)}
                className="bg-zinc-900 border border-zinc-850 text-zinc-300 text-xs px-2.5 py-1 rounded-lg focus:outline-none cursor-pointer"
              >
                <option value="1d">Color: 1D % Change</option>
                <option value="pe">Color: P/E Ratio</option>
              </select>
            </div>
          </div>

          {/* Right Metrics: Search, Refresh, Fullscreen */}
          <div className="flex items-center gap-2">
            <div className="relative hidden lg:block">
              <Search size={12} className="absolute left-2.5 top-2.5 text-zinc-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search ticker or sector..."
                className="w-36 h-7 pl-7 pr-2.5 bg-zinc-950 border border-zinc-850 rounded-lg text-xs text-white placeholder-zinc-650 focus:outline-none focus:border-zinc-700"
              />
            </div>

            <span className="text-zinc-500 text-[11px] font-semibold">{filteredStocks.length} assets shown</span>

            <button
              onClick={() => {
                setStocks([...ALL_STOCKS]);
              }}
              className="p-1.5 bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white rounded-lg transition-colors"
              title="Refresh Heatmap Feeds"
            >
              <RefreshCw size={13} />
            </button>

            <button
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="p-1.5 bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white rounded-lg transition-colors"
              title="Toggle Fullscreen"
            >
              {isFullscreen ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
            </button>
          </div>
        </div>

        {/* ─── MAIN DISPLAY AREA: HEATMAP TREEMAP GRID ─── */}
        <div className="p-4 bg-[#05070e] min-h-[540px]">
          {viewMode === 'heatmap' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
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
                      <span className="text-[10px] text-zinc-500 font-semibold">{sectorStocks.length} stocks</span>
                    </div>

                    {/* Stock Tiles Treemap Container */}
                    <div className="grid grid-cols-2 gap-2 flex-1 min-h-[180px]">
                      {sectorStocks.map((stock) => {
                        const isUp = stock.changePct >= 0;
                        const isLarge = stock.marketCapNum > 1000;

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
                              isUp
                                ? "bg-emerald-950/40 border-emerald-600/40 hover:border-emerald-400 hover:shadow-emerald-900/40"
                                : "bg-red-950/40 border-red-600/40 hover:border-red-400 hover:shadow-red-900/40"
                            )}
                          >
                            {/* Brand Logo & Symbol Header */}
                            <div className="flex items-start justify-between">
                              {renderBrandLogo(stock.logoType, stock.symbol, stock.logoBg)}
                              {stock.aiTag && (
                                <span className="text-[8px] bg-purple-500/20 text-purple-300 border border-purple-500/30 px-1 py-0.2 rounded font-extrabold uppercase">
                                  AI
                                </span>
                              )}
                            </div>

                            {/* Stock Name & Ticker */}
                            <div className="mt-1">
                              <span className="text-xs font-black text-white block tracking-wide leading-tight group-hover:text-blue-300">
                                {stock.symbol}
                              </span>
                              <span className={cn("text-[10px] font-extrabold block mt-0.5", isUp ? "text-emerald-400" : "text-red-400")}>
                                {isUp ? '+' : ''}{stock.changePct.toFixed(2)}%
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
                    <th className="py-3 px-4">Company Name</th>
                    <th className="py-3 px-4">Sector</th>
                    <th className="py-3 px-4 text-right">Price</th>
                    <th className="py-3 px-4 text-right">1D Change %</th>
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
                        <td className="py-3 px-4 text-right font-bold text-white">${stock.price.toFixed(2)}</td>
                        <td className={cn("py-3 px-4 text-right font-extrabold", isUp ? "text-emerald-400" : "text-red-400")}>
                          {isUp ? '+' : ''}{stock.changePct.toFixed(2)}%
                        </td>
                        <td className="py-3 px-4 text-right text-zinc-300 font-semibold">{stock.marketCap}</td>
                        <td className="py-3 px-4 text-right text-zinc-400">{stock.peRatio}</td>
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
                      <span className="text-xs font-bold text-white">${stock.price.toFixed(2)}</span>
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
          title="✦ Gemini AI Screener Market Intelligence"
        >
          <div className="space-y-3">
            <div className="p-3.5 bg-purple-950/30 border border-purple-800/40 rounded-xl flex items-start gap-3">
              <Bot size={22} className="text-purple-400 shrink-0 mt-0.5" />
              <div className="space-y-2">
                <h5 className="text-xs font-bold text-purple-300">Market Heatmap Bias Summary</h5>
                <p className="text-xs text-zinc-300 leading-relaxed">
                  Overall market sentiment is currently <strong>Bullish on Tech & Semiconductor AI Leaders</strong> (NVDA +0.84%, META +1.00%, CAT +4.30%). Consumer & Big Tech equities are undergoing mild consolidation (AAPL -2.51%, TSLA -5.92%).
                </p>
                <div className="p-2 bg-black/50 rounded-lg border border-purple-900/40 text-[11px] text-purple-200">
                  ⚡ <strong>AI Top Recommendation:</strong> NVDA and ASML are showing accumulation above 20-period moving averages.
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
          title="Heatmap & Screener Settings"
        >
          <div className="space-y-3 text-xs">
            <div className="flex justify-between items-center p-2 bg-zinc-900 rounded-lg">
              <span>Color Scheme</span>
              <span className="font-bold text-emerald-400">Green / Red Standard</span>
            </div>
            <div className="flex justify-between items-center p-2 bg-zinc-900 rounded-lg">
              <span>Display Brand Logos</span>
              <span className="font-bold text-blue-400">Enabled</span>
            </div>

            <div className="flex justify-end pt-2">
              <Button size="sm" className="bg-blue-600 text-white" onClick={() => setSettingsOpen(false)}>
                Save Preferences
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* ─── STOCK INSPECT & TRADE MODAL ─── */}
      {detailModalOpen && selectedStock && (
        <Modal
          isOpen={detailModalOpen}
          onClose={() => setDetailModalOpen(false)}
          title={`Stock Analysis: ${selectedStock.symbol} (${selectedStock.name})`}
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
                <span className="text-base font-black text-white block">${selectedStock.price.toFixed(2)}</span>
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
                className="bg-blue-600 hover:bg-blue-500 text-white font-bold"
                onClick={() => {
                  setDetailModalOpen(false);
                  window.location.href = `/market`;
                }}
              >
                Trade on Exness / TradingView
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
