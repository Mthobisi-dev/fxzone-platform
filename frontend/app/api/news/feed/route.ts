import { NextResponse } from 'next/server';

export async function GET() {
  const timestamp = new Date().toISOString();

  const newsItems = [
    {
      id: 'news-1',
      title: 'NVIDIA Announces Next-Gen Blackwell Ultra Architecture for AI Accelerators',
      summary: 'Data center chip demand surges as enterprise hyperscalers expand cloud capacity.',
      source: 'Bloomberg Financial',
      url: 'https://finance.yahoo.com',
      published_at: timestamp,
      category: 'stock',
      sentiment: 'bullish',
      related_symbols: ['NVDA', 'MSFT', 'GOOGL'],
    },
    {
      id: 'news-2',
      title: 'Bitcoin Spot ETF Inflows Reach Record Weekly Volume',
      summary: 'Institutional asset managers increase allocation to digital assets following regulatory clarity.',
      source: 'CoinDesk Intelligence',
      url: 'https://coindesk.com',
      published_at: timestamp,
      category: 'crypto',
      sentiment: 'bullish',
      related_symbols: ['BTCUSD', 'ETHUSD', 'SOLUSD'],
    },
    {
      id: 'news-3',
      title: 'ECB Signals Potential Interest Rate Adjustments Amid Eurozone Inflation Trends',
      summary: 'Forex traders monitor EUR/USD key psychological support levels closely ahead of economic releases.',
      source: 'Reuters Markets',
      url: 'https://reuters.com',
      published_at: timestamp,
      category: 'forex',
      sentiment: 'neutral',
      related_symbols: ['EURUSD', 'GBPUSD', 'USDJPY'],
    },
    {
      id: 'news-4',
      title: 'Gold Touches Highs Supported by Central Bank Reserve Accumulation',
      summary: 'Precious metals hedge against inflation as global monetary policy remains dynamic.',
      source: 'Financial Times',
      url: 'https://ft.com',
      published_at: timestamp,
      category: 'commodity',
      sentiment: 'bullish',
      related_symbols: ['XAUUSD', 'XAGUSD'],
    },
  ];

  return NextResponse.json(newsItems, {
    headers: {
      'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=300',
    },
  });
}
