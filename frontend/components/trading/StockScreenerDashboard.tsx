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
  Star
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useMarketStore } from '@/stores/marketStore';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';

// Mock data representing comprehensive market stock sectors matching TradingView Heatmap
export interface HeatmapStock {
  symbol: string;
  name: string;
  sector: string;
  subSector?: string;
  marketCap: string; // e.g. "3.2T"
  marketCapNum: number; // For box sizing
  price: number;
  changePct: number;
  peRatio: number;
  aiTag?: boolean;
  logoBg: string;
  logoType?: 'apple' | 'nvidia' | 'google' | 'microsoft' | 'meta' | 'amazon' | 'tesla' | 'lilly' | 'jnj' | 'generic';
}

const INITIAL_STOCKS: HeatmapStock[] = [
  // ─── ELECTRONIC TECHNOLOGY ───
  { symbol: 'NVDA', name: 'NVIDIA Corp', sector: 'Electronic technology', marketCap: '3.12T', marketCapNum: 3120, price: 126.80, changePct: 0.84, peRatio: 72.4, aiTag: true, logoBg: '#76b900', logoType: 'nvidia' },
  { symbol: 'AAPL', name: 'Apple Inc.', sector: 'Electronic technology', marketCap: '3.45T', marketCapNum: 3450, price: 221.40, changePct: -2.51, peRatio: 33.1, logoBg: '#000000', logoType: 'apple' },
  { symbol: 'AVGO', name: 'Broadcom Inc.', sector: 'Electronic technology', marketCap: '780B', marketCapNum: 780, price: 168.20, changePct: 0.21, peRatio: 48.2, aiTag: true, logoBg: '#cc092f', logoType: 'generic' },
  { symbol: 'INTC', name: 'Intel Corp', sector: 'Electronic technology', marketCap: '95B', marketCapNum: 195, price: 21.50, changePct: 4.69, peRatio: 18.4, logoBg: '#0068b5', logoType: 'generic' },
  { symbol: 'QCOM', name: 'Qualcomm Inc.', sector: 'Electronic technology', marketCap: '190B', marketCapNum: 290, price: 172.10, changePct: 4.51, peRatio: 22.1, logoBg: '#3253dc', logoType: 'generic' },
  { symbol: 'AMD', name: 'Advanced Micro Devices', sector: 'Electronic technology', marketCap: '250B', marketCapNum: 350, price: 154.30, changePct: 0.52, peRatio: 110.2, aiTag: true, logoBg: '#ed1c24', logoType: 'generic' },

  // ─── TECHNOLOGY SERVICES ───
  { symbol: 'GOOG', name: 'Alphabet Inc.', sector: 'Technology services', marketCap: '2.10T', marketCapNum: 2100, price: 158.40, changePct: -1.11, peRatio: 24.2, aiTag: true, logoBg: '#ffffff', logoType: 'google' },
  { symbol: 'MSFT', name: 'Microsoft Corp', sector: 'Technology services', marketCap: '3.28T', marketCapNum: 3280, price: 432.10, changePct: -2.04, peRatio: 36.5, aiTag: true, logoBg: '#00a4ef', logoType: 'microsoft' },
  { symbol: 'META', name: 'Meta Platforms Inc.', sector: 'Technology services', marketCap: '1.30T', marketCapNum: 1300, price: 512.60, changePct: 1.00, peRatio: 26.8, aiTag: true, logoBg: '#0081fb', logoType: 'meta' },
  { symbol: 'NFLX', name: 'Netflix Inc.', sector: 'Technology services', marketCap: '280B', marketCapNum: 280, price: 685.10, changePct: -5.30, peRatio: 42.1, logoBg: '#e50914', logoType: 'generic' },
  { symbol: 'ADBE', name: 'Adobe Inc.', sector: 'Technology services', marketCap: '240B', marketCapNum: 240, price: 540.20, changePct: 0.40, peRatio: 46.3, logoBg: '#ff0000', logoType: 'generic' },
  { symbol: 'ORCL', name: 'Oracle Corp', sector: 'Technology services', marketCap: '380B', marketCapNum: 380, price: 142.10, changePct: 3.20, peRatio: 38.1, logoBg: '#f80000', logoType: 'generic' },

  // ─── HEALTH TECHNOLOGY ───
  { symbol: 'LLY', name: 'Eli Lilly and Co.', sector: 'Health technology', marketCap: '820B', marketCapNum: 820, price: 945.10, changePct: -0.88, peRatio: 115.0, logoBg: '#d51900', logoType: 'lilly' },
  { symbol: 'JNJ', name: 'Johnson & Johnson', sector: 'Health technology', marketCap: '390B', marketCapNum: 390, price: 162.30, changePct: -1.15, peRatio: 21.5, logoBg: '#d51900', logoType: 'jnj' },
  { symbol: 'PFE', name: 'Pfizer Inc.', sector: 'Health technology', marketCap: '160B', marketCapNum: 260, price: 28.40, changePct: -1.50, peRatio: 15.2, logoBg: '#0093d0', logoType: 'generic' },
  { symbol: 'UNH', name: 'UnitedHealth Group', sector: 'Health technology', marketCap: '530B', marketCapNum: 530, price: 582.40, changePct: -0.40, peRatio: 28.1, logoBg: '#002677', logoType: 'generic' },

  // ─── RETAIL TRADE ───
  { symbol: 'AMZN', name: 'Amazon.com Inc.', sector: 'Retail trade', marketCap: '1.92T', marketCapNum: 1920, price: 186.20, changePct: -0.15, peRatio: 41.2, aiTag: true, logoBg: '#ff9900', logoType: 'amazon' },
  { symbol: 'WMT', name: 'Walmart Inc.', sector: 'Retail trade', marketCap: '580B', marketCapNum: 580, price: 72.80, changePct: 0.80, peRatio: 34.0, logoBg: '#0071ce', logoType: 'generic' },
  { symbol: 'COST', name: 'Costco Wholesale', sector: 'Retail trade', marketCap: '380B', marketCapNum: 380, price: 865.10, changePct: 1.10, peRatio: 52.3, logoBg: '#e31837', logoType: 'generic' },

  // ─── PRODUCER MANUFACTURING ───
  { symbol: 'CAT', name: 'Caterpillar Inc.', sector: 'Producer manufacturing', marketCap: '180B', marketCapNum: 280, price: 345.80, changePct: 4.30, peRatio: 16.2, logoBg: '#ffcd00', logoType: 'generic' },
  { symbol: 'GE', name: 'General Electric', sector: 'Producer manufacturing', marketCap: '190B', marketCapNum: 290, price: 172.40, changePct: 1.20, peRatio: 31.0, logoBg: '#056dae', logoType: 'generic' },
  { symbol: 'HON', name: 'Honeywell Int.', sector: 'Producer manufacturing', marketCap: '130B', marketCapNum: 230, price: 202.10, changePct: -0.50, peRatio: 22.4, logoBg: '#de1d25', logoType: 'generic' },

  // ─── COMMUNICATIONS ───
  { symbol: 'SPCX', name: 'SpaceX Communications', sector: 'Communications', marketCap: '210B', marketCapNum: 310, price: 185.00, changePct: -1.20, peRatio: 45.0, logoBg: '#000000', logoType: 'generic' },
  { symbol: 'TMUS', name: 'T-Mobile US Inc.', sector: 'Communications', marketCap: '230B', marketCapNum: 330, price: 198.40, changePct: 0.90, peRatio: 24.1, logoBg: '#e20074', logoType: 'generic' },
  { symbol: 'VZ', name: 'Verizon Comms', sector: 'Communications', marketCap: '170B', marketCapNum: 270, price: 41.20, changePct: -0.30, peRatio: 9.8, logoBg: '#cd040b', logoType: 'generic' },

  // ─── CONSUMER DURABLES ───
  { symbol: 'TSLA', name: 'Tesla Inc.', sector: 'Consumer durables', marketCap: '680B', marketCapNum: 1680, price: 215.20, changePct: -5.92, peRatio: 65.4, aiTag: true, logoBg: '#e82127', logoType: 'tesla' },
  { symbol: 'TM', name: 'Toyota Motor Corp', sector: 'Consumer durables', marketCap: '260B', marketCapNum: 360, price: 195.40, changePct: 0.30, peRatio: 8.5, logoBg: '#eb0a1e', logoType: 'generic' },

  // ─── FINANCE ───
  { symbol: 'BRK.A', name: 'Berkshire Hathaway', sector: 'Finance', marketCap: '950B', marketCapNum: 950, price: 685000, changePct: -0.48, peRatio: 21.0, logoBg: '#112244', logoType: 'generic' },
  { symbol: 'JPM', name: 'JPMorgan Chase', sector: 'Finance', marketCap: '620B', marketCapNum: 620, price: 214.50, changePct: 0.21, peRatio: 12.4, logoBg: '#0a2240', logoType: 'generic' },
  { symbol: 'V', name: 'Visa Inc.', sector: 'Finance', marketCap: '560B', marketCapNum: 560, price: 278.40, changePct: -0.90, peRatio: 30.1, logoBg: '#1a1f71', logoType: 'generic' },
  { symbol: 'MS', name: 'Morgan Stanley', sector: 'Finance', marketCap: '160B', marketCapNum: 260, price: 102.30, changePct: 0.20, peRatio: 16.5, logoBg: '#002b49', logoType: 'generic' },

  // ─── ENERGY MINERALS ───
  { symbol: 'XOM', name: 'Exxon Mobil Corp', sector: 'Energy minerals', marketCap: '480B', marketCapNum: 480, price: 118.20, changePct: -1.69, peRatio: 14.1, logoBg: '#ff0000', logoType: 'generic' },
  { symbol: 'CVX', name: 'Chevron Corp', sector: 'Energy minerals', marketCap: '280B', marketCapNum: 280, price: 144.10, changePct: -1.29, peRatio: 13.8, logoBg: '#0054a6', logoType: 'generic' },
];

export function StockScreenerDashboard() {
  const { setSelectedAsset } = useMarketStore();
  const [stocks, setStocks] = useState<HeatmapStock[]>(INITIAL_STOCKS);
  const [selectedCountry, setSelectedCountry] = useState<'US' | 'GLOBAL' | 'EU' | 'CRYPTO'>('US');
  const [aiFilterActive, setAiFilterActive] = useState(false);
  const [selectedSectorFilter, setSelectedSectorFilter] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'heatmap' | 'grid' | 'table'>('heatmap');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStock, setSelectedStock] = useState<HeatmapStock | null>(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Live real-time tick simulation for price dynamics
  useEffect(() => {
    const interval = setInterval(() => {
      setStocks((prev) =>
        prev.map((s) => {
          if (Math.random() > 0.6) {
            const deltaPct = (Math.random() - 0.49) * 0.15;
            const newPct = parseFloat((s.changePct + deltaPct).toFixed(2));
            const newPrice = parseFloat((s.price * (1 + deltaPct / 100)).toFixed(2));
            return { ...s, changePct: newPct, price: newPrice };
          }
          return s;
        })
      );
    }, 4000);

    return () => clearInterval(interval);
  }, []);

  // Filter logic
  const filteredStocks = stocks.filter((s) => {
    if (aiFilterActive && !s.aiTag) return false;
    if (selectedSectorFilter !== 'all' && s.sector !== selectedSectorFilter) return false;
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
        {/* ─── TOP CONTROL BAR (TITLE, UNDO, SETTINGS) ─── */}
        <div className="bg-[#0a0e1a] px-4 py-3 border-b border-zinc-850 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-extrabold text-white flex items-center gap-2">
              Stock Screener <ChevronDown size={16} className="text-zinc-400 cursor-pointer" />
            </h2>
          </div>

          <div className="flex items-center gap-2 text-zinc-400">
            <button className="p-1.5 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors" title="Undo">
              <RotateCcw size={14} />
            </button>
            <button className="p-1.5 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors" title="Redo">
              <RotateCw size={14} />
            </button>
            <button className="p-1.5 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors" title="Screener Settings">
              <Settings size={15} />
            </button>
          </div>
        </div>

        {/* ─── ROW 1: PRIMARY FILTER PILLS ─── */}
        <div className="px-4 py-2.5 bg-[#080c16] border-b border-zinc-850 flex items-center gap-1.5 overflow-x-auto scrollbar-none">
          {/* AI Filter Button (Purple Glowing Pill) */}
          <button
            onClick={() => setAiFilterActive(!aiFilterActive)}
            className={cn(
              "px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shrink-0 border",
              aiFilterActive
                ? "bg-purple-600 text-white border-purple-400 shadow-lg shadow-purple-900/40"
                : "bg-purple-950/30 text-purple-300 border-purple-800/50 hover:bg-purple-900/40"
            )}
          >
            <Sparkles size={13} className="text-purple-400 animate-pulse" />
            <span>✦ AI</span>
          </button>

          {/* Country Selector */}
          <button
            onClick={() => {
              const options: Array<'US' | 'GLOBAL' | 'EU' | 'CRYPTO'> = ['US', 'GLOBAL', 'EU', 'CRYPTO'];
              const next = options[(options.indexOf(selectedCountry) + 1) % options.length];
              setSelectedCountry(next);
            }}
            className="px-3 py-1.5 bg-zinc-900/90 border border-zinc-800 hover:border-zinc-700 text-white font-semibold text-xs rounded-xl flex items-center gap-1.5 shrink-0"
          >
            <span className="text-sm">{selectedCountry === 'US' ? '🇺🇸' : selectedCountry === 'EU' ? '🇪🇺' : '🌐'}</span>
            <span>{selectedCountry}</span>
            <ChevronDown size={12} className="text-zinc-500" />
          </button>

          {/* Quick Filter Pill Options matching user's image */}
          {['Watchlist', 'Index', 'Price', 'Chg %', 'Mkt cap', 'P/E', 'EPS dil growth', 'Div yield %', 'Sector'].map((f) => (
            <button
              key={f}
              onClick={() => {
                if (f === 'Sector') {
                  const sectors = ['all', 'Electronic technology', 'Technology services', 'Health technology', 'Retail trade', 'Finance'];
                  const idx = sectors.indexOf(selectedSectorFilter);
                  setSelectedSectorFilter(sectors[(idx + 1) % sectors.length]);
                }
              }}
              className={cn(
                "px-2.5 py-1.5 bg-zinc-900/80 border border-zinc-850 hover:border-zinc-750 text-zinc-300 hover:text-white text-xs font-medium rounded-xl flex items-center gap-1 shrink-0 transition-all",
                f === 'Sector' && selectedSectorFilter !== 'all' && "border-blue-500 text-blue-400 bg-blue-950/30"
              )}
            >
              <span>{f === 'Sector' && selectedSectorFilter !== 'all' ? `Sector: ${selectedSectorFilter}` : f}</span>
              <ChevronDown size={11} className="text-zinc-500" />
            </button>
          ))}
        </div>

        {/* ─── ROW 2: SECONDARY METRIC FILTERS ─── */}
        <div className="px-4 py-2 bg-[#060912] border-b border-zinc-850 flex items-center gap-1.5 overflow-x-auto scrollbar-none text-zinc-400">
          {['Analyst rating', 'Perf %', 'Revenue growth', 'PEG', 'ROE', 'Beta', 'EV / gross profit'].map((f) => (
            <button
              key={f}
              className="px-2.5 py-1 bg-zinc-950/60 border border-zinc-850/80 hover:border-zinc-750 text-zinc-400 hover:text-zinc-200 text-[11px] font-medium rounded-lg flex items-center gap-1 shrink-0 transition-all"
            >
              <span>{f}</span>
              <ChevronDown size={10} className="text-zinc-600" />
            </button>
          ))}

          <button className="px-2 py-1 bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white rounded-lg text-xs font-bold" title="Add Filter">
            <Plus size={13} />
          </button>
          <button className="px-2 py-1 bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white rounded-lg text-xs font-bold" title="More Options">
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

            {/* Metric Selectors */}
            <div className="hidden sm:flex items-center gap-2">
              <div className="flex items-center gap-1 bg-zinc-900 px-2.5 py-1 rounded-lg border border-zinc-850 text-zinc-300">
                <Maximize2 size={11} className="text-zinc-500" />
                <span>Mkt cap</span>
                <ChevronDown size={11} className="text-zinc-500" />
              </div>

              <div className="flex items-center gap-1 bg-zinc-900 px-2.5 py-1 rounded-lg border border-zinc-850 text-zinc-300">
                <span className="w-2.5 h-2.5 rounded-xs bg-emerald-500" />
                <span className="w-2.5 h-2.5 rounded-xs bg-red-500" />
                <span>Chg %, 1D</span>
                <ChevronDown size={11} className="text-zinc-500" />
              </div>

              <div className="flex items-center gap-1 bg-zinc-900 px-2.5 py-1 rounded-lg border border-zinc-850 text-zinc-300">
                <Layers size={11} className="text-zinc-500" />
                <span>Sector</span>
                <ChevronDown size={11} className="text-zinc-500" />
              </div>
            </div>
          </div>

          {/* Right Metrics: Total count, Search, Refresh, Fullscreen */}
          <div className="flex items-center gap-2">
            <div className="relative hidden lg:block">
              <Search size={12} className="absolute left-2.5 top-2.5 text-zinc-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search symbol, sector..."
                className="w-36 h-7 pl-7 pr-2.5 bg-zinc-950 border border-zinc-850 rounded-lg text-xs text-white placeholder-zinc-650 focus:outline-none focus:border-zinc-700"
              />
            </div>

            <span className="text-zinc-500 text-[11px] font-semibold">{filteredStocks.length * 280} total</span>

            <button
              onClick={() => setStocks([...INITIAL_STOCKS])}
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
                      <span className="text-xs font-extrabold text-zinc-300 flex items-center gap-1 hover:text-blue-400 cursor-pointer">
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
                <span className="font-bold text-white">{selectedStock.peRatio}</span>
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
