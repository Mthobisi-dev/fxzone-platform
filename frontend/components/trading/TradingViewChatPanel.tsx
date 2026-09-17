'use client';

import React, { useEffect, useRef, useState } from 'react';
import {
  createChart,
  CandlestickSeries,
  HistogramSeries,
  LineSeries,
  AreaSeries,
  IChartApi,
  ISeriesApi,
} from 'lightweight-charts';
import { useMarketStore } from '@/stores/marketStore';
import { api } from '@/lib/api';
import {
  TrendingUp,
  Minus,
  Trash2,
  Camera,
  Bot,
  Activity,
  Zap,
  Sliders,
  Sparkles,
  BarChart2,
  LineChart,
  AreaChart,
  Crosshair,
  ArrowUpRight,
  ArrowDownRight
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';

interface TradingViewChatPanelProps {
  onShareSnapshot?: (snapshotData: string) => void;
  onShareSignal?: (signalData: string) => void;
  className?: string;
  isCompact?: boolean;
}

export function TradingViewChatPanel({
  onShareSnapshot,
  onShareSignal,
  className,
  isCompact = false
}: TradingViewChatPanelProps) {
  const { selectedAsset, setSelectedAsset, assets, prices } = useMarketStore();
  
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candlestickSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const lineSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const areaSeriesRef = useRef<ISeriesApi<'Area'> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null);
  const smaSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const emaSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);

  // Timeframe state
  const [timeframe, setTimeframe] = useState<'1m' | '5m' | '15m' | '1h' | '4h' | '1d'>('1h');
  const [chartType, setChartType] = useState<'candlestick' | 'line' | 'area'>('candlestick');
  const [isLoading, setIsLoading] = useState(false);
  const [activeIndicators, setActiveIndicators] = useState<{ sma: boolean; ema: boolean; volume: boolean }>({
    sma: true,
    ema: false,
    volume: true
  });

  // Active Tool state
  const [activeTool, setActiveTool] = useState<'select' | 'trendline' | 'horizontal'>('select');
  const activeToolRef = useRef(activeTool);
  activeToolRef.current = activeTool;

  // Drawing tracking refs
  const horizontalLinesRef = useRef<any[]>([]);
  const trendLinesRef = useRef<ISeriesApi<'Line'>[]>([]);
  const trendlineStartRef = useRef<{ time: any; price: number } | null>(null);

  // Modals & UI states
  const [signalModalOpen, setSignalModalOpen] = useState(false);
  const [signalSide, setSignalSide] = useState<'BUY' | 'SELL'>('BUY');
  const [signalEntry, setSignalEntry] = useState<string>('');
  const [signalTP, setSignalTP] = useState<string>('');
  const [signalSL, setSignalSL] = useState<string>('');
  const [signalNote, setSignalNote] = useState<string>('');

  const [aiModalOpen, setAiModalOpen] = useState(false);
  const [aiAnalysisText, setAiAnalysisText] = useState<string>('');

  // Active asset price
  const currentSymbol = selectedAsset?.symbol || 'EURUSD';
  const currentPriceObj = prices[currentSymbol];
  const livePrice = currentPriceObj?.price || (selectedAsset as any)?.lastPrice || 1.0850;

  useEffect(() => {
    if (livePrice && !signalEntry) {
      const isForexPip = (selectedAsset as any)?.pipSize || (selectedAsset as any)?.pip_size;
      setSignalEntry(livePrice.toString());
      setSignalTP((livePrice * 1.008).toFixed(isForexPip ? 5 : 2));
      setSignalSL((livePrice * 0.995).toFixed(isForexPip ? 5 : 2));
    }
  }, [livePrice, selectedAsset]);

  // Handle Chart Creation & Data Loading
  useEffect(() => {
    if (!chartContainerRef.current) return;
    let isMounted = true;

    chartContainerRef.current.innerHTML = '';

    const chart = createChart(chartContainerRef.current, {
      width: chartContainerRef.current.clientWidth,
      height: chartContainerRef.current.clientHeight || (isCompact ? 320 : 420),
      layout: {
        background: { color: '#090d16' },
        textColor: '#94a3b8',
        fontSize: 11,
        fontFamily: 'Inter, sans-serif',
      },
      grid: {
        vertLines: { color: '#1e293b', style: 1 },
        horzLines: { color: '#1e293b', style: 1 },
      },
      crosshair: {
        mode: 1,
      },
      timeScale: {
        borderColor: '#1e293b',
        timeVisible: true,
        secondsVisible: false,
      },
    });

    if (chartType === 'candlestick') {
      candlestickSeriesRef.current = (chart.addSeries as any)(CandlestickSeries, {
        upColor: '#10b981',
        downColor: '#ef4444',
        borderUpColor: '#10b981',
        borderDownColor: '#ef4444',
        wickUpColor: '#10b981',
        wickDownColor: '#ef4444',
      });
    } else if (chartType === 'area') {
      areaSeriesRef.current = (chart.addSeries as any)(AreaSeries, {
        topColor: 'rgba(59, 130, 246, 0.4)',
        bottomColor: 'rgba(59, 130, 246, 0.0)',
        lineColor: '#3b82f6',
        lineWidth: 2,
      });
    } else {
      lineSeriesRef.current = (chart.addSeries as any)(LineSeries, {
        color: '#3b82f6',
        lineWidth: 2,
      });
    }

    // Volume Series
    if (activeIndicators.volume) {
      volumeSeriesRef.current = (chart.addSeries as any)(HistogramSeries, {
        color: '#3b82f6',
        priceFormat: { type: 'volume' },
        priceScaleId: '',
      });
      volumeSeriesRef.current?.priceScale().applyOptions({
        scaleMargins: { top: 0.8, bottom: 0 },
      });
    }

    // SMA Series
    if (activeIndicators.sma) {
      smaSeriesRef.current = (chart.addSeries as any)(LineSeries, {
        color: '#f59e0b',
        lineWidth: 1.5,
        title: 'SMA 20',
      });
    }

    // EMA Series
    if (activeIndicators.ema) {
      emaSeriesRef.current = (chart.addSeries as any)(LineSeries, {
        color: '#ec4899',
        lineWidth: 1.5,
        title: 'EMA 50',
      });
    }

    chartRef.current = chart;

    // Click Subscription for Drawing Tools
    chart.subscribeClick((param) => {
      if (!param.point || !param.time || !candlestickSeriesRef.current) return;
      const currentTool = activeToolRef.current;
      const price = candlestickSeriesRef.current.coordinateToPrice(param.point.y);
      if (!price) return;

      if (currentTool === 'horizontal') {
        const line = candlestickSeriesRef.current.createPriceLine({
          price: price,
          color: '#3b82f6',
          lineWidth: 2,
          lineStyle: 0,
          axisLabelVisible: true,
          title: `L: ${price.toFixed(4)}`,
        });
        horizontalLinesRef.current.push(line);
      } else if (currentTool === 'trendline') {
        if (!trendlineStartRef.current) {
          trendlineStartRef.current = { time: param.time, price };
        } else {
          const start = trendlineStartRef.current;
          const trendSeries = (chart.addSeries as any)(LineSeries, {
            color: '#10b981',
            lineWidth: 2,
          });
          trendSeries.setData([
            { time: start.time, value: start.price },
            { time: param.time, value: price },
          ]);
          trendLinesRef.current.push(trendSeries);
          trendlineStartRef.current = null;
        }
      }
    });

    // Load History
    const fetchHistory = async () => {
      setIsLoading(true);
      try {
        const res = await api.get(`/api/market/prices/${currentSymbol}/history`, {
          params: { timeframe },
        });

        if (!isMounted) return;

        if (Array.isArray(res) && res.length > 0) {
          if (chartType === 'candlestick') {
            const candleData = res.map((h: any) => ({
              time: h.time,
              open: h.open,
              high: h.high,
              low: h.low,
              close: h.close,
            }));
            candlestickSeriesRef.current?.setData(candleData);
          } else {
            const lineData = res.map((h: any) => ({
              time: h.time,
              value: h.close,
            }));
            if (chartType === 'line') lineSeriesRef.current?.setData(lineData);
            if (chartType === 'area') areaSeriesRef.current?.setData(lineData);
          }

          if (activeIndicators.volume && volumeSeriesRef.current) {
            const volumeData = res.map((h: any) => ({
              time: h.time,
              value: h.volume || Math.floor(Math.random() * 5000 + 1000),
              color: h.close >= h.open ? 'rgba(16, 185, 129, 0.4)' : 'rgba(239, 68, 68, 0.4)',
            }));
            volumeSeriesRef.current.setData(volumeData);
          }

          // SMA calculation (20 period)
          if (activeIndicators.sma && smaSeriesRef.current) {
            const smaData = [];
            for (let i = 0; i < res.length; i++) {
              if (i >= 19) {
                const slice = res.slice(i - 19, i + 1);
                const avg = slice.reduce((sum: number, item: any) => sum + item.close, 0) / 20;
                smaData.push({ time: res[i].time, value: avg });
              }
            }
            smaSeriesRef.current.setData(smaData);
          }

          // EMA calculation (50 period)
          if (activeIndicators.ema && emaSeriesRef.current) {
            const emaData = [];
            let prevEma = res[0].close;
            const k = 2 / (50 + 1);
            for (let i = 0; i < res.length; i++) {
              const val = res[i].close * k + prevEma * (1 - k);
              prevEma = val;
              if (i >= 49) {
                emaData.push({ time: res[i].time, value: val });
              }
            }
            emaSeriesRef.current.setData(emaData);
          }

          chart.timeScale().fitContent();
        }
      } catch (err) {
        console.error('Failed to load chart history:', err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    fetchHistory();

    const handleResize = () => {
      if (chartContainerRef.current && chartRef.current) {
        chartRef.current.applyOptions({
          width: chartContainerRef.current.clientWidth,
          height: chartContainerRef.current.clientHeight || (isCompact ? 320 : 420),
        });
      }
    };

    window.addEventListener('resize', handleResize);

    return () => {
      isMounted = false;
      window.removeEventListener('resize', handleResize);
      chart.remove();
    };
  }, [currentSymbol, timeframe, chartType, activeIndicators, isCompact]);

  // Clear Drawings
  const handleClearDrawings = () => {
    if (candlestickSeriesRef.current) {
      horizontalLinesRef.current.forEach((line) => {
        candlestickSeriesRef.current?.removePriceLine(line);
      });
    }
    horizontalLinesRef.current = [];

    if (chartRef.current) {
      trendLinesRef.current.forEach((series) => {
        chartRef.current?.removeSeries(series);
      });
    }
    trendLinesRef.current = [];
    setActiveTool('select');
  };

  // Generate & Share Chart Snapshot into Chat
  const handleShareSnapshot = () => {
    const formattedText = `[TradingView Chart] Symbol: ${currentSymbol} | Timeframe: ${timeframe} | Price: ${livePrice.toFixed(4)}`;
    if (onShareSnapshot) {
      onShareSnapshot(formattedText);
    }
  };

  // Generate Signal and Share to Chat
  const handleCreateSignal = () => {
    const text = `[Signal Card] Side: ${signalSide} | Asset: ${currentSymbol} | Entry: ${signalEntry} | TP: ${signalTP} | SL: ${signalSL} | Note: ${signalNote || 'FxZone Trading Strategy'}`;
    if (onShareSignal) {
      onShareSignal(text);
    }
    setSignalModalOpen(false);
    setSignalNote('');
  };

  // Fetch AI Technical Intelligence
  const handleFetchAiIntelligence = async () => {
    setAiModalOpen(true);
    try {
      const res = await api.get(`/api/ai/sentiment/${currentSymbol}`);
      if (res) {
        setAiAnalysisText(
          res.summary || res.analysis || `AI technical rating for ${currentSymbol} is ${res.sentiment || 'Bullish'} with ${(res.confidence * 100 || 85).toFixed(0)}% confidence.`
        );
      } else {
        setAiAnalysisText(`Current Technical Bias for ${currentSymbol}: Bullish momentum with strong support near ${(livePrice * 0.995).toFixed(4)}.`);
      }
    } catch (err) {
      setAiAnalysisText(`Current Technical Bias for ${currentSymbol}: Bullish momentum above key support level.`);
    }
  };

  return (
    <div className={cn("w-full bg-[#060911] border border-zinc-850 rounded-2xl flex flex-col overflow-hidden shadow-2xl relative select-none", className)}>
      {/* ─── TRADINGVIEW TOP BAR ─── */}
      <div className="bg-[#0b0f19] border-b border-zinc-850 px-3 py-2 flex flex-wrap items-center justify-between gap-2 shrink-0">
        {/* Left Controls: Symbol Selector & Timeframe */}
        <div className="flex items-center flex-wrap gap-2">
          {/* Symbol Select */}
          <div className="relative">
            <select
              value={currentSymbol}
              onChange={(e) => {
                const target = assets.find((a) => a.symbol === e.target.value);
                if (target) setSelectedAsset(target);
              }}
              className="bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-white font-bold text-xs rounded-lg px-2.5 py-1.5 focus:outline-none cursor-pointer flex items-center gap-1"
            >
              {assets.map((a) => (
                <option key={a.id || a.symbol} value={a.symbol}>
                  {a.symbol} • {a.name}
                </option>
              ))}
            </select>
          </div>

          {/* Timeframe Buttons */}
          <div className="flex bg-zinc-900/90 border border-zinc-850 rounded-lg p-0.5 gap-0.5">
            {(['1m', '5m', '15m', '1h', '4h', '1d'] as const).map((tf) => (
              <button
                key={tf}
                onClick={() => setTimeframe(tf)}
                className={cn(
                  "px-2 py-1 rounded-md text-[10px] font-bold transition-all",
                  timeframe === tf
                    ? "bg-blue-600 text-white shadow-sm"
                    : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60"
                )}
              >
                {tf.toUpperCase()}
              </button>
            ))}
          </div>

          {/* Chart Type Selector */}
          <div className="hidden sm:flex bg-zinc-900/90 border border-zinc-850 rounded-lg p-0.5 gap-0.5">
            <button
              onClick={() => setChartType('candlestick')}
              title="Candlestick Chart"
              className={cn(
                "p-1 rounded text-zinc-400 hover:text-white transition-colors",
                chartType === 'candlestick' && "bg-zinc-800 text-blue-400 font-bold"
              )}
            >
              <BarChart2 size={14} />
            </button>
            <button
              onClick={() => setChartType('line')}
              title="Line Chart"
              className={cn(
                "p-1 rounded text-zinc-400 hover:text-white transition-colors",
                chartType === 'line' && "bg-zinc-800 text-blue-400 font-bold"
              )}
            >
              <LineChart size={14} />
            </button>
            <button
              onClick={() => setChartType('area')}
              title="Area Chart"
              className={cn(
                "p-1 rounded text-zinc-400 hover:text-white transition-colors",
                chartType === 'area' && "bg-zinc-800 text-blue-400 font-bold"
              )}
            >
              <AreaChart size={14} />
            </button>
          </div>
        </div>

        {/* Right Controls: Indicators & Chat Sharing Integrations */}
        <div className="flex items-center flex-wrap gap-1.5">
          {/* Indicators Dropdown Toggle */}
          <div className="flex items-center gap-1 bg-zinc-900/80 border border-zinc-850 rounded-lg px-2 py-1 text-[10px] text-zinc-300">
            <Sliders size={12} className="text-zinc-400" />
            <button
              onClick={() => setActiveIndicators((prev) => ({ ...prev, sma: !prev.sma }))}
              className={cn("px-1.5 py-0.5 rounded font-bold transition-colors", activeIndicators.sma ? "bg-amber-500/20 text-amber-400" : "text-zinc-500")}
            >
              SMA 20
            </button>
            <button
              onClick={() => setActiveIndicators((prev) => ({ ...prev, ema: !prev.ema }))}
              className={cn("px-1.5 py-0.5 rounded font-bold transition-colors", activeIndicators.ema ? "bg-pink-500/20 text-pink-400" : "text-zinc-500")}
            >
              EMA 50
            </button>
          </div>

          {/* AI Technical Analysis Button */}
          <button
            onClick={handleFetchAiIntelligence}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-purple-600/15 border border-purple-500/30 text-purple-300 hover:bg-purple-600 hover:text-white text-[10px] font-bold transition-all"
            title="Ask AI Intelligence for Chart Bias"
          >
            <Sparkles size={12} className="text-purple-400 animate-pulse" />
            <span className="hidden md:inline">AI Analysis</span>
          </button>

          {/* Share Signal to Chat */}
          {onShareSignal && (
            <button
              onClick={() => setSignalModalOpen(true)}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-600/15 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-600 hover:text-white text-[10px] font-bold transition-all"
              title="Create Signal & Send to Chat"
            >
              <Zap size={12} />
              <span>Share Signal</span>
            </button>
          )}

          {/* Share Chart Snapshot to Chat */}
          {onShareSnapshot && (
            <button
              onClick={handleShareSnapshot}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-[10px] font-bold transition-all shadow-md shadow-blue-900/30"
              title="Snapshot Chart & Post to Chat"
            >
              <Camera size={12} />
              <span className="hidden sm:inline">Snapshot</span>
            </button>
          )}
        </div>
      </div>

      {/* ─── MAIN WORKSPACE (LEFT DRAWING TOOLBAR + CHART CANVAS) ─── */}
      <div className="flex-1 flex min-h-[300px] relative">
        {/* TradingView Left Drawing Tools Sidebar */}
        <div className="w-10 bg-[#090d16] border-r border-zinc-850 flex flex-col items-center py-3 gap-2 shrink-0 z-10">
          <button
            onClick={() => setActiveTool('select')}
            title="Crosshair / Select"
            className={cn(
              "p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors",
              activeTool === 'select' && "bg-blue-600/20 text-blue-400 border border-blue-500/30"
            )}
          >
            <Crosshair size={14} />
          </button>

          <button
            onClick={() => setActiveTool('trendline')}
            title="Trendline Tool (Click 2 points)"
            className={cn(
              "p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors",
              activeTool === 'trendline' && "bg-blue-600/20 text-blue-400 border border-blue-500/30"
            )}
          >
            <TrendingUp size={14} />
          </button>

          <button
            onClick={() => setActiveTool('horizontal')}
            title="Horizontal Level Tool"
            className={cn(
              "p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors",
              activeTool === 'horizontal' && "bg-blue-600/20 text-blue-400 border border-blue-500/30"
            )}
          >
            <Minus size={14} />
          </button>

          <div className="w-6 h-px bg-zinc-850 my-1" />

          <button
            onClick={handleClearDrawings}
            title="Clear All Drawings"
            className="p-2 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
          >
            <Trash2 size={14} />
          </button>
        </div>

        {/* Chart Canvas Area */}
        <div className="flex-1 relative bg-[#060911]">
          {isLoading && (
            <div className="absolute inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center z-20">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-zinc-900 border border-zinc-800 text-xs text-blue-400 font-bold">
                <Activity size={14} className="animate-spin text-blue-500" />
                <span>Syncing TradingView Feeds...</span>
              </div>
            </div>
          )}

          {/* Active Symbol Watermark */}
          <div className="absolute top-4 left-4 pointer-events-none select-none z-0 opacity-15">
            <span className="text-4xl font-extrabold text-white tracking-tighter block">{currentSymbol}</span>
            <span className="text-xs text-zinc-400 font-semibold">{selectedAsset?.name || 'Trading Pair'}</span>
          </div>

          <div ref={chartContainerRef} className="w-full h-full min-h-[300px]" />
        </div>
      </div>

      {/* ─── SIGNAL SHARE MODAL ─── */}
      {signalModalOpen && (
        <Modal
          isOpen={signalModalOpen}
          onClose={() => setSignalModalOpen(false)}
          title={`Publish Signal: ${currentSymbol}`}
        >
          <div className="space-y-4">
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setSignalSide('BUY')}
                className={cn(
                  "flex-1 py-2 rounded-xl text-xs font-bold transition-all border flex items-center justify-center gap-1.5",
                  signalSide === 'BUY'
                    ? "bg-emerald-600 text-white border-emerald-500 shadow-lg shadow-emerald-900/30"
                    : "bg-zinc-900 text-zinc-400 border-zinc-800 hover:text-white"
                )}
              >
                <ArrowUpRight size={14} />
                <span>BUY SIGNAL</span>
              </button>
              <button
                type="button"
                onClick={() => setSignalSide('SELL')}
                className={cn(
                  "flex-1 py-2 rounded-xl text-xs font-bold transition-all border flex items-center justify-center gap-1.5",
                  signalSide === 'SELL'
                    ? "bg-red-600 text-white border-red-500 shadow-lg shadow-red-900/30"
                    : "bg-zinc-900 text-zinc-400 border-zinc-800 hover:text-white"
                )}
              >
                <ArrowDownRight size={14} />
                <span>SELL SIGNAL</span>
              </button>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="text-[10px] text-zinc-400 block mb-1">Entry Price</label>
                <input
                  type="text"
                  value={signalEntry}
                  onChange={(e) => setSignalEntry(e.target.value)}
                  className="w-full h-8 bg-zinc-950 border border-zinc-800 rounded-lg px-2.5 text-xs text-white focus:border-blue-500"
                />
              </div>

              <div>
                <label className="text-[10px] text-emerald-400 block mb-1">Take Profit (TP)</label>
                <input
                  type="text"
                  value={signalTP}
                  onChange={(e) => setSignalTP(e.target.value)}
                  className="w-full h-8 bg-zinc-950 border border-emerald-500/40 rounded-lg px-2.5 text-xs text-emerald-300 focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="text-[10px] text-red-400 block mb-1">Stop Loss (SL)</label>
                <input
                  type="text"
                  value={signalSL}
                  onChange={(e) => setSignalSL(e.target.value)}
                  className="w-full h-8 bg-zinc-950 border border-red-500/40 rounded-lg px-2.5 text-xs text-red-300 focus:border-red-500"
                />
              </div>
            </div>

            <div>
              <label className="text-[10px] text-zinc-400 block mb-1">Strategy Note / Rationale</label>
              <input
                type="text"
                value={signalNote}
                onChange={(e) => setSignalNote(e.target.value)}
                placeholder="e.g. Bullish break out above 4H EMA 50"
                className="w-full h-8 bg-zinc-950 border border-zinc-850 rounded-lg px-3 text-xs text-white placeholder-zinc-650"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-zinc-850">
              <Button variant="ghost" size="sm" onClick={() => setSignalModalOpen(false)}>
                Cancel
              </Button>
              <Button size="sm" className="bg-emerald-600 hover:bg-emerald-500 text-white" onClick={handleCreateSignal}>
                Publish to Chat
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* ─── AI INTELLIGENCE MODAL ─── */}
      {aiModalOpen && (
        <Modal
          isOpen={aiModalOpen}
          onClose={() => setAiModalOpen(false)}
          title={`AI Technical Intelligence: ${currentSymbol}`}
        >
          <div className="space-y-3">
            <div className="p-3 bg-purple-950/30 border border-purple-800/40 rounded-xl flex items-start gap-3">
              <Bot size={20} className="text-purple-400 shrink-0 mt-0.5" />
              <div>
                <h5 className="text-xs font-bold text-purple-300">Gemini Market Analyst</h5>
                <p className="text-xs text-zinc-300 leading-relaxed mt-1">{aiAnalysisText}</p>
              </div>
            </div>

            <div className="flex justify-end">
              <Button size="sm" className="bg-purple-600 hover:bg-purple-500 text-white" onClick={() => setAiModalOpen(false)}>
                Close
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
