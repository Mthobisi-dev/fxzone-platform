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
