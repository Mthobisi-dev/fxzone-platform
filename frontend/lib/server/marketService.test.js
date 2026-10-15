const { test } = require('node:test');
const assert = require('node:assert/strict');

async function loadMarketService() {
  return import('./marketService.ts');
}

test('builds delayed forex quotes from official Frankfurter daily rates without a market-data key', async () => {
  const { buildFrankfurterForexQuotes } = await loadMarketService();
  const quotes = buildFrankfurterForexQuotes({
    rates: {
      '2026-10-08': { USD: 1.16, GBP: 0.86, JPY: 176.2, AUD: 1.76, CAD: 1.61, NZD: 1.93, CHF: 0.93 },
      '2026-10-09': { USD: 1.17, GBP: 0.87, JPY: 177.1, AUD: 1.77, CAD: 1.62, NZD: 1.94, CHF: 0.94 },
    },
  });

  assert.equal(quotes.EURUSD.data_source, 'frankfurter');
  assert.equal(quotes.EURUSD.freshness, 'delayed');
  assert.equal(quotes.EURUSD.is_live, false);
  assert.equal(quotes.EURUSD.price, 1.17);
  assert.ok(quotes.EURUSD.change_pct > 0);
  assert.equal(quotes.USDJPY.price, 177.1 / 1.17);
});

test('does not create forex quotes when two provider dates are unavailable', async () => {
  const { buildFrankfurterForexQuotes } = await loadMarketService();
  assert.deepEqual(buildFrankfurterForexQuotes({ rates: { '2026-10-09': { USD: 1.17 } } }), {});
});

test('maps Yahoo Finance fallback data as explicitly delayed provider data', async () => {
  const { buildYahooFinanceQuotes } = await loadMarketService();
  const quotes = buildYahooFinanceQuotes({
    spark: {
      result: [{
        symbol: 'NVDA',
        response: [{
          meta: {
            regularMarketPrice: 229.86,
            regularMarketChangePercent: -0.267,
            regularMarketChange: -0.615,
            regularMarketTime: 1_791_573_529,
            regularMarketDayHigh: 233.89,
            regularMarketDayLow: 229.11,
            regularMarketOpen: 233.875,
            regularMarketVolume: 59_800_587,
          },
          timestamp: [1_791_462_600, 1_791_552_600],
          indicators: { quote: [{ close: [230.48, 229.86] }] },
        }],
      }],
    },
  });

  assert.equal(quotes.NVDA.data_source, 'yahoo_finance');
  assert.equal(quotes.NVDA.freshness, 'delayed');
  assert.equal(quotes.NVDA.is_live, false);
  assert.equal(quotes.NVDA.price, 229.86);
  assert.equal(quotes.NVDA.change_pct, -0.267);
  assert.equal(quotes.NVDA.volume, 59_800_587);
});

test('calculates equity market cap from a provider quote and shares outstanding', async () => {
  const { calculateEquityMarketCap, addYahooSharesOutstanding } = await loadMarketService();

  assert.equal(calculateEquityMarketCap(140, 24_000_000_000), 3_360_000_000_000);
  assert.equal(calculateEquityMarketCap(0, 24_000_000_000), null);
  assert.equal(calculateEquityMarketCap(140, null), null);
  assert.equal(calculateEquityMarketCap(true, 10), null);
  assert.equal(calculateEquityMarketCap(140, [10]), null);

  const enriched = addYahooSharesOutstanding({ NVDA: {
    symbol: 'NVDA', price: 140, change: 1, change_pct: 0.72,
    market_cap: null, data_source: 'yahoo_finance', freshness: 'delayed',
    is_live: false, is_stale: false,
  } }, [{ symbol: 'NVDA', sharesOutstanding: 24_000_000_000 }]);

  assert.equal(enriched.NVDA.market_cap, 3_360_000_000_000);
  assert.equal(enriched.NVDA.market_cap_method, 'calculated');
});

test('does not invent equity market cap when provider shares are missing or invalid', async () => {
  const { addYahooSharesOutstanding } = await loadMarketService();
  const quotes = { NVDA: {
    symbol: 'NVDA', price: 140, change: 1, change_pct: 0.72,
    market_cap: null, data_source: 'yahoo_finance', freshness: 'delayed',
    is_live: false, is_stale: false,
  } };

  assert.equal(addYahooSharesOutstanding(quotes, [{ symbol: 'NVDA', sharesOutstanding: 0 }]).NVDA.market_cap, null);
  assert.equal(addYahooSharesOutstanding(quotes, []).NVDA.market_cap, null);
});

test('parses complete Yahoo Finance candles without generating missing values', async () => {
  const { parseYahooFinanceCandles } = await loadMarketService();
  const candles = parseYahooFinanceCandles({
    chart: {
      result: [{
        timestamp: [1_791_462_600, 1_791_552_600],
        indicators: {
          quote: [{
            open: [230, null],
            high: [232, 234],
            low: [229, 228],
            close: [231, 230],
            volume: [100, 200],
          }],
        },
      }],
    },
  });

  assert.deepEqual(candles, [{
    time: 1_791_462_600,
    open: 230,
    high: 232,
    low: 229,
    close: 231,
    volume: 100,
  }]);
});

test('splits Yahoo Finance symbol requests into provider-safe batches', async () => {
  const { splitYahooFinanceSymbols } = await loadMarketService();
  const batches = splitYahooFinanceSymbols(['NVDA', 'AAPL', 'MSFT', 'GOOGL', 'AMZN'], 2);

  assert.deepEqual(batches, [
    ['NVDA', 'AAPL'],
    ['MSFT', 'GOOGL'],
    ['AMZN'],
  ]);
});

test('keeps successful Yahoo batches when another batch or company metadata fails', async () => {
  const { fetchYahooFinanceQuotes } = await loadMarketService();
  const quotes = await fetchYahooFinanceQuotes(async (input) => {
    const url = new URL(input);
    const symbols = url.searchParams.get('symbols').split(',');
    if (url.pathname.endsWith('/quote')) return { ok: false, status: 401 };
    if (!symbols.includes('NVDA')) throw new Error('One provider batch is unavailable');
    return { ok: true, json: async () => ({ spark: { result: [{ symbol: 'NVDA', response: [{ meta: {
      regularMarketPrice: 140, regularMarketChange: 1, regularMarketChangePercent: 0.72,
      regularMarketTime: 1_791_573_529,
    } }] }] } }) };
  });
  assert.equal(quotes.NVDA.price, 140);
  assert.equal(quotes.NVDA.market_cap, null);
  assert.equal(quotes.NVDA.freshness, 'delayed');
});

test('malformed market-cap metadata cannot remove otherwise valid quotes', async () => {
  const { fetchYahooFinanceQuotes } = await loadMarketService();
  const quotes = await fetchYahooFinanceQuotes(async (input) => {
    const url = new URL(input);
    if (url.pathname.endsWith('/quote')) return { ok: true, json: async () => ({ quoteResponse: { result: {} } }) };
    return { ok: true, json: async () => ({ spark: { result: [{ symbol: 'NVDA', response: [{ meta: {
      regularMarketPrice: 140, regularMarketChange: 1, regularMarketChangePercent: 0.72,
      regularMarketTime: 1_791_573_529,
    } }] }] } }) };
  });
  assert.equal(quotes.NVDA.price, 140);
  assert.equal(quotes.NVDA.market_cap, null);
});
