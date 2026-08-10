'use client';

import React, { useEffect, useRef, useState } from 'react';
import { createChart, CandlestickSeries, HistogramSeries, LineSeries, IChartApi, ISeriesApi } from 'lightweight-charts';
import { useMarketStore } from '@/stores/marketStore';
import { api } from '@/lib/api';
import { Card } from '../ui/Card';
import { useTheme } from '@/hooks/useTheme';
import { cn } from '@/lib/utils';
import { 
  MousePointer, 
  TrendingUp, 
  Minus, 
  Trash2, 
  Maximize2, 
  Minimize2, 
  ChevronUp, 
  ChevronDown 
} from 'lucide-react';

const getBucketTimestamp = (timestamp: number, timeframe: string): number => {
  const date = new Date(timestamp * 1000);
  switch (timeframe) {
    case '1m':
      date.setSeconds(0, 0);
      return Math.floor(date.getTime() / 1000);
    case '5m':
      date.setSeconds(0, 0);
      const min5 = Math.floor(date.getMinutes() / 5) * 5;
      date.setMinutes(min5);
      return Math.floor(date.getTime() / 1000);
    case '15m':
      date.setSeconds(0, 0);
      const min15 = Math.floor(date.getMinutes() / 15) * 15;
      date.setMinutes(min15);
      return Math.floor(date.getTime() / 1000);
    case '1h':
      date.setMinutes(0, 0, 0);
      return Math.floor(date.getTime() / 1000);
    case '4h':
      date.setMinutes(0, 0, 0);
      const hour4 = Math.floor(date.getHours() / 4) * 4;
      date.setHours(hour4);
      return Math.floor(date.getTime() / 1000);
    case '1d':
    default:
      return Math.floor(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) / 1000);
  }
};

export function CandlestickChart() {
  const { selectedAsset, prices } = useMarketStore();
  const { theme } = useTheme();
  
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candlestickSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null);
  const latestCandleTimeRef = useRef<number | null>(null);
  
  const [timeframe, setTimeframe] = useState<'1m' | '5m' | '15m' | '1h' | '1d'>('1h');
  const [isLoading, setIsLoading] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);

  // Drawing states
  const [activeTool, setActiveTool] = useState<'select' | 'trendline' | 'horizontal'>('select');
  const [trendlineStart, setTrendlineStart] = useState<{ time: any; price: number } | null>(null);

  // Drawing refs (to keep event subscription callbacks fresh and prevent closure bugs)
  const activeToolRef = useRef<'select' | 'trendline' | 'horizontal'>('select');
  const trendlineStartRef = useRef<{ time: any; price: number } | null>(null);
  const trendLinesRef = useRef<ISeriesApi<'Line'>[]>([]);
  const horizontalLinesRef = useRef<any[]>([]);

  // Timeframes available
  const timeframes: { label: string; value: '1m' | '5m' | '15m' | '1h' | '1d' }[] = [
    { label: '1m', value: '1m' },
    { label: '5m', value: '5m' },
    { label: '15m', value: '15m' },
    { label: '1h', value: '1h' },
    { label: '1d', value: '1d' }
  ];

  // Tool selection handler
  const selectTool = (tool: 'select' | 'trendline' | 'horizontal') => {
    setActiveTool(tool);
    activeToolRef.current = tool;
    trendlineStartRef.current = null;
    setTrendlineStart(null);
  };

  // Clear all drawings
  const clearDrawings = () => {
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

    selectTool('select');
  };

  // 1. Fetch historical data and render chart
  useEffect(() => {
    if (!selectedAsset) return;
    if (!chartContainerRef.current) return;

    let isMounted = true;

    chartContainerRef.current.innerHTML = ''; // Clear container

    // Determine colors based on current theme
    const isDark = theme !== 'minimal-light';
    const bgColor = isDark ? '#0a0e17' : '#ffffff';
    const textColor = isDark ? '#9ca3af' : '#64748b';
    const gridColor = isDark ? '#1f2937' : '#e2e8f0';

    // Calculate height dynamically
    const initialHeight = isMaximized ? window.innerHeight - 150 : 380;

    // Create chart
    const chart = createChart(chartContainerRef.current, {
      width: chartContainerRef.current.clientWidth,
      height: initialHeight,
      layout: {
        background: { color: bgColor },
        textColor: textColor,
        fontSize: 10,
        fontFamily: 'JetBrains Mono, monospace',
      },
      grid: {
        vertLines: { color: gridColor, style: 1 },
        horzLines: { color: gridColor, style: 1 },
      },
      crosshair: {
        mode: 1, // Normal crosshair
      },
      timeScale: {
        borderColor: gridColor,
        timeVisible: true,
        secondsVisible: false,
      },
    });

    // Add candlestick series (v5 API)
    const candlestickSeries = (chart.addSeries as any)(CandlestickSeries, {
      upColor: '#10b981',
      downColor: '#ef4444',
      borderUpColor: '#10b981',
      borderDownColor: '#ef4444',
      wickUpColor: '#10b981',
      wickDownColor: '#ef4444',
    });

    // Add volume series (v5 API)
    const volumeSeries = (chart.addSeries as any)(HistogramSeries, {
      color: '#3b82f6',
      priceFormat: {
        type: 'volume',
      },
      priceScaleId: '', // Overlay over chart
    });

    volumeSeries.priceScale().applyOptions({
      scaleMargins: {
        top: 0.8, // volume takes bottom 20%
        bottom: 0,
      },
    });

    chartRef.current = chart;
    candlestickSeriesRef.current = candlestickSeries;
    volumeSeriesRef.current = volumeSeries;

    // Load data
    const loadData = async () => {
      setIsLoading(true);
      try {
        const history = await api.get(`/api/market/prices/${selectedAsset.symbol}/history`, {
          params: { timeframe },
        });

        if (!isMounted) return;

        if (Array.isArray(history) && history.length > 0) {
          // Format candlestick and volume data
          const candleData = history.map((h: any) => ({
            time: h.time,
            open: h.open,
            high: h.high,
            low: h.low,
            close: h.close,
          }));

          const volData = history.map((h: any) => ({
            time: h.time,
            value: h.volume,
            color: h.close >= h.open ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)',
          }));

          candlestickSeries.setData(candleData);
          volumeSeries.setData(volData);

          if (candleData.length > 0) {
            latestCandleTimeRef.current = candleData[candleData.length - 1].time as number;
          }
        }
      } catch (err) {
        if (isMounted) console.error('Chart history fetch failed:', err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    loadData();

    // Click handler for drawings subscribed to the chart API
    const clickHandler = (param: any) => {
      if (!isMounted) return;
      const tool = activeToolRef.current;
      if (tool === 'select') return;
      if (!param.point || !param.time) return;

      const price = candlestickSeries.coordinateToPrice(param.point.y);
      if (price === null) return;

      if (tool === 'horizontal') {
        const priceLine = candlestickSeries.createPriceLine({
          price: price,
          color: '#a855f7', // Nice neon purple support/resistance line
          lineWidth: 2,
          lineStyle: 2, // Dashed
          axisLabelVisible: true,
          title: `L: ${price.toFixed(selectedAsset.symbol.toLowerCase().includes('usd') ? 2 : 4)}`,
        });
        horizontalLinesRef.current.push(priceLine);
        selectTool('select');
      } else if (tool === 'trendline') {
        if (!trendlineStartRef.current) {
          // First point of trend line
          const startPt = { time: param.time, price };
          trendlineStartRef.current = startPt;
          setTrendlineStart(startPt);
        } else {
          // Ensure time scale parameters are sorted to prevent lightweight-charts assertion crash
          const t1 = Number(trendlineStartRef.current.time);
          const t2 = Number(param.time);
          
          let p1: any = { time: t1, value: trendlineStartRef.current.price };
          let p2: any = { time: t2, value: price };
          
          if (t1 === t2) {
            // Avoid equal timestamps assertion error by adding 1 second
            p2.time = t2 + 1;
          } else if (t1 > t2) {
            // Swap to ensure strict ascending order if user draws right-to-left
            p1 = { time: t2, value: price };
            p2 = { time: t1, value: trendlineStartRef.current.price };
          }

          // Second point - draw line and save reference
          const lineSeries = (chart.addSeries as any)(LineSeries, {
            color: '#3b82f6', // Bright neon blue trend line
            lineWidth: 2,
            priceLineVisible: false,
            lastValueVisible: false,
          });
          lineSeries.setData([p1, p2]);
          trendLinesRef.current.push(lineSeries);

          // Reset trendline tool selection
          trendlineStartRef.current = null;
          setTrendlineStart(null);
          selectTool('select');
        }
      }
    };

    chart.subscribeClick(clickHandler);

    // Resize observer
    const handleResize = () => {
      if (isMounted && chartContainerRef.current && chartRef.current) {
        const height = isMaximized ? window.innerHeight - 150 : 380;
        chartRef.current.resize(chartContainerRef.current.clientWidth, height);
      }
    };
    window.addEventListener('resize', handleResize);

    return () => {
      isMounted = false;
      window.removeEventListener('resize', handleResize);
      if (chartRef.current) {
        chartRef.current.unsubscribeClick(clickHandler);
      }
      chart.remove();
      chartRef.current = null;
      candlestickSeriesRef.current = null;
      volumeSeriesRef.current = null;
      trendLinesRef.current = [];
      horizontalLinesRef.current = [];
    };
  }, [selectedAsset, timeframe, theme]);

  // 2. Feed live websocket updates to chart
  useEffect(() => {
    if (!selectedAsset) return;
    if (!candlestickSeriesRef.current || !volumeSeriesRef.current) return;

    const liveData = prices[selectedAsset.symbol.toUpperCase()];
    if (!liveData) return;

    let timestamp = Math.floor(new Date(liveData.timestamp).getTime() / 1000);
    let bucketTimestamp = getBucketTimestamp(timestamp, timeframe);

    const lastTime = latestCandleTimeRef.current;
    if (lastTime !== null) {
      if (bucketTimestamp < lastTime) {
        // Enforce update to last candle instead of inserting backward in time
        bucketTimestamp = lastTime;
      } else {
        latestCandleTimeRef.current = bucketTimestamp;
      }
    }

    // Update last candle in chart
    candlestickSeriesRef.current.update({
      time: bucketTimestamp as any,
      open: liveData.open,
      high: liveData.high,
      low: liveData.low,
      close: liveData.price,
    });

    volumeSeriesRef.current.update({
      time: bucketTimestamp as any,
      value: liveData.volume,
      color: liveData.price >= liveData.open ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)',
    });
  }, [prices, selectedAsset, timeframe]);

  // 3. Resize chart immediately when maximized state changes
  useEffect(() => {
    let active = true;
    let timerId: any = null;

    const doResize = () => {
      if (active && chartRef.current && chartContainerRef.current) {
        const height = isMaximized ? window.innerHeight - 150 : 380;
        chartRef.current.resize(chartContainerRef.current.clientWidth, height);
      }
    };

    doResize();
    // Schedule a secondary resize to catch the end of the Tailwind transition
    timerId = setTimeout(doResize, 100);

    return () => {
      active = false;
      if (timerId) clearTimeout(timerId);
    };
  }, [isMaximized]);

  if (isMinimized) {
    return (
      <Card className="p-3 bg-zinc-950/60 border-zinc-900/80 flex items-center justify-between h-[60px] transition-all duration-300">
        <div className="flex items-center gap-2">
          {selectedAsset && (
            <div className="flex items-baseline gap-2">
              <span className="text-sm font-bold text-white uppercase">{selectedAsset.symbol}</span>
              <span className="text-xs text-zinc-500">{selectedAsset.name}</span>
            </div>
          )}
          <span className="text-[10px] bg-zinc-900/50 text-zinc-400 px-2 py-0.5 rounded-full border border-zinc-800">Minimized</span>
        </div>
        <button
          onClick={() => setIsMinimized(false)}
          className="p-1.5 text-zinc-400 hover:text-white bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 hover:border-zinc-700 rounded-lg transition-colors flex items-center gap-1.5 text-[10px] font-semibold"
        >
          <ChevronDown size={14} />
          Restore Chart
        </button>
      </Card>
    );
  }

  return (
    <Card 
      className={cn(
        "p-4 bg-zinc-950/40 border-zinc-900/60 flex flex-col gap-4 overflow-hidden relative transition-all duration-300",
        isMaximized ? "fixed inset-0 z-50 bg-zinc-950 p-6 h-screen w-screen" : "h-full"
      )}
    >
      {/* Chart Control Bar */}
      <div className="flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          {selectedAsset && (
            <div className="flex items-baseline gap-2">
              <span className="text-sm font-bold text-white uppercase tracking-wider">{selectedAsset.symbol}</span>
              <span className="text-xs text-zinc-500">{selectedAsset.name}</span>
            </div>
          )}
          {trendlineStart && (
            <div className="text-[9px] text-blue-400 bg-blue-500/10 px-2.5 py-0.5 rounded-full border border-blue-500/20 animate-pulse font-medium">
              Trend Line: Click end point...
            </div>
          )}
          {activeTool === 'horizontal' && (
            <div className="text-[9px] text-purple-400 bg-purple-500/10 px-2.5 py-0.5 rounded-full border border-purple-500/20 animate-pulse font-medium">
              Horizontal Line: Click chart...
            </div>
          )}
        </div>

        <div className="flex items-center gap-3">
          {/* Timeframe Selectors */}
          <div className="flex items-center gap-1 bg-zinc-900/40 border border-zinc-850 p-0.5 rounded-lg select-none">
            {timeframes.map((tf) => (
              <button
                key={tf.value}
                onClick={() => setTimeframe(tf.value)}
                className={cn(
                  'px-2 py-0.5 text-[10px] font-semibold rounded-md transition-all focus:outline-none',
                  timeframe === tf.value
                    ? 'bg-zinc-800 text-white shadow-sm'
                    : 'text-zinc-500 hover:text-zinc-300'
                )}
              >
                {tf.label}
              </button>
            ))}
          </div>

          {/* Window Control Buttons */}
          <div className="flex items-center gap-1 border-l border-zinc-850 pl-3">
            <button
              onClick={() => setIsMaximized(!isMaximized)}
              title={isMaximized ? "Restore size" : "Maximize chart"}
              className="p-1 text-zinc-500 hover:text-white hover:bg-zinc-900 border border-transparent hover:border-zinc-850 rounded-md transition-all focus:outline-none"
            >
              {isMaximized ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
            </button>
            {!isMaximized && (
              <button
                onClick={() => setIsMinimized(true)}
                title="Minimize chart"
                className="p-1 text-zinc-500 hover:text-white hover:bg-zinc-900 border border-transparent hover:border-zinc-850 rounded-md transition-all focus:outline-none"
              >
                <ChevronUp size={13} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Area: Sidebar Drawing Tools + Chart Canvas */}
      <div className="flex-1 flex gap-4 min-h-0 relative">
        {/* Drawing Toolbar on the left */}
        <div className="flex flex-col gap-1.5 p-1 bg-zinc-900/30 border border-zinc-850/50 rounded-lg shrink-0 justify-start select-none">
          <button
            onClick={() => selectTool('select')}
            title="Cursor / Select"
            className={cn(
              "p-2 rounded-md transition-all focus:outline-none",
              activeTool === 'select'
                ? "bg-zinc-800 text-white border border-zinc-700/50"
                : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900/40"
            )}
          >
            <MousePointer size={14} />
          </button>
          
          <button
            onClick={() => selectTool('trendline')}
            title="Draw Trend Line"
            className={cn(
              "p-2 rounded-md transition-all focus:outline-none",
              activeTool === 'trendline'
                ? "bg-blue-600/30 text-blue-400 border border-blue-500/30"
                : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900/40"
            )}
          >
            <TrendingUp size={14} />
          </button>

          <button
            onClick={() => selectTool('horizontal')}
            title="Draw Horizontal Line (S/R Level)"
            className={cn(
              "p-2 rounded-md transition-all focus:outline-none",
              activeTool === 'horizontal'
                ? "bg-purple-600/30 text-purple-400 border border-purple-500/30"
                : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900/40"
            )}
          >
            <Minus size={14} />
          </button>

          <div className="border-t border-zinc-850/80 my-1" />

          <button
            onClick={clearDrawings}
            title="Clear all drawings"
            className="p-2 text-zinc-500 hover:text-red-400 hover:bg-red-500/10 rounded-md transition-all focus:outline-none"
          >
            <Trash2 size={14} />
          </button>
        </div>

        {/* Chart Canvas Container */}
        <div className="flex-1 min-w-0 h-full relative bg-zinc-950/20 rounded-lg">
          {isLoading && (
            <div className="absolute inset-0 bg-zinc-950/40 backdrop-blur-xs flex items-center justify-center z-10 rounded-lg">
              <div className="h-6 w-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            </div>
          )}
          <div ref={chartContainerRef} className="w-full h-full" />
        </div>
      </div>
    </Card>
  );
}
