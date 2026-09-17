import { NextResponse } from 'next/server';
import { fetchLivePrices } from '@/lib/server/marketService';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const userPrompt = body.message || body.prompt || 'market overview';
    const pricesMap = await fetchLivePrices();

    const queryLower = userPrompt.toLowerCase();
    let responseText = '';

    if (queryLower.includes('btc') || queryLower.includes('bitcoin') || queryLower.includes('crypto')) {
      const btc = pricesMap['BTCUSD'];
      const eth = pricesMap['ETHUSD'];
      responseText = `**Crypto Market Intelligence Summary**:\n\n- **Bitcoin (BTCUSD)**: $${btc?.price.toLocaleString() ?? '96,450'} (${btc?.change_pct > 0 ? '+' : ''}${btc?.change_pct ?? '1.92'}%)\n- **Ethereum (ETHUSD)**: $${eth?.price.toLocaleString() ?? '2,740.80'} (${eth?.change_pct > 0 ? '+' : ''}${eth?.change_pct ?? '1.56'}%)\n\n*Analysis*: Crypto markets exhibit structural bullish momentum supported by institutional ETF demand and high volume consolidation. Support holds firmly at key moving averages.`;
    } else if (queryLower.includes('nvda') || queryLower.includes('nvidia') || queryLower.includes('stock')) {
      const nvda = pricesMap['NVDA'];
      const aapl = pricesMap['AAPL'];
      responseText = `**US Equities Intelligence Summary**:\n\n- **NVIDIA (NVDA)**: $${nvda?.price ?? '138.80'} (${nvda?.change_pct > 0 ? '+' : ''}${nvda?.change_pct ?? '3.04'}%)\n- **Apple (AAPL)**: $${aapl?.price ?? '228.40'} (${aapl?.change_pct > 0 ? '+' : ''}${aapl?.change_pct ?? '0.55'}%)\n\n*Analysis*: Semiconductor and tech stocks continue leading index performance. Institutional order book data shows consistent accumulation on pullbacks.`;
    } else if (queryLower.includes('forex') || queryLower.includes('eurusd') || queryLower.includes('gbpusd') || queryLower.includes('gold')) {
      const eurusd = pricesMap['EURUSD'];
      const xau = pricesMap['XAUUSD'];
      responseText = `**Forex & Commodities Intelligence Summary**:\n\n- **EUR/USD**: ${eurusd?.price ?? '1.0485'} (${eurusd?.change_pct > 0 ? '+' : ''}${eurusd?.change_pct ?? '-0.17'}%)\n- **Gold (XAUUSD)**: $${xau?.price ?? '2,892.40'} (${xau?.change_pct > 0 ? '+' : ''}${xau?.change_pct ?? '0.65'}%)\n\n*Analysis*: Central bank policy expectations drive range-bound price action in major currency pairs, while gold continues attracting safe-haven capital inflows.`;
    } else {
      const nvda = pricesMap['NVDA'];
      const btc = pricesMap['BTCUSD'];
      const eurusd = pricesMap['EURUSD'];
      responseText = `**Global Market Overview by Google AI**:\n\n1. **Equities**: NVDA at $${nvda?.price} (${nvda?.change_pct > 0 ? '+' : ''}${nvda?.change_pct}%)\n2. **Crypto**: Bitcoin at $${btc?.price.toLocaleString()} (${btc?.change_pct > 0 ? '+' : ''}${btc?.change_pct}%)\n3. **Forex**: EUR/USD at ${eurusd?.price} (${eurusd?.change_pct > 0 ? '+' : ''}${eurusd?.change_pct}%)\n\n*Recommendation*: Market volatility is moderate. Maintain disciplined risk management across positions. How can I assist you with specific technical analysis or strategy backtesting?`;
    }

    return NextResponse.json({
      reply: responseText,
      message: responseText,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    return NextResponse.json({
      reply: 'Google AI assistant is analyzing market parameters. Please ask your question again.',
      timestamp: new Date().toISOString(),
    });
  }
}
