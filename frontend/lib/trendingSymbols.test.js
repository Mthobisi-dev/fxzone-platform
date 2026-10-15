const { test } = require('node:test');
const assert = require('node:assert/strict');

async function loadTrendingSymbols() {
  return import('./trendingSymbols.ts');
}

test('recognizes canonical symbols, cashtags, slash pairs, and asset tags once per post', async () => {
  const { countPostSymbolMentions } = await loadTrendingSymbols();
  const counts = countPostSymbolMentions([
    { content: 'Watching $BTC and BTC/USD with NVDA.', asset_tags: ['BTCUSD', 'NVDA'] },
    { content: 'EUR/USD and gold are moving.', asset_tags: ['XAUUSD'] },
    { content: '$ADA and META are in today\'s watchlist.', asset_tags: [] },
  ]);

  assert.deepEqual(counts, { ADAUSD: 1, BTCUSD: 1, EURUSD: 1, META: 1, NVDA: 1, XAUUSD: 1 });
});

test('ranks discussed symbols first and fills empty space with verified provider movers', async () => {
  const { buildTrendingSymbols } = await loadTrendingSymbols();
  const result = buildTrendingSymbols(
    { NVDA: 3 },
    {
      NVDA: { symbol: 'NVDA', price: 100, change_pct: 1.1, freshness: 'delayed', data_source: 'yahoo_finance' },
      BTCUSD: { symbol: 'BTCUSD', price: 80000, change_pct: -4.2, freshness: 'live', data_source: 'coingecko' },
      EURUSD: { symbol: 'EURUSD', price: 1.1, change_pct: 0.8, freshness: 'delayed', data_source: 'frankfurter' },
    },
    3
  );

  assert.deepEqual(result.map((item) => [item.symbol, item.basis]), [
    ['NVDA', 'community'],
    ['BTCUSD', 'market_movement'],
    ['EURUSD', 'market_movement'],
  ]);
  assert.equal(result[1].change_pct, -4.2);
});

test('does not treat ordinary short words as stock or crypto symbols', async () => {
  const { countPostSymbolMentions } = await loadTrendingSymbols();

  assert.deepEqual(countPostSymbolMentions([
    { content: 'A useful link about a cat, a dot, and a meta description.', asset_tags: [] },
  ]), {});
});

test('does not manufacture trends without discussions or provider quotes', async () => {
  const { buildTrendingSymbols } = await loadTrendingSymbols();

  assert.deepEqual(buildTrendingSymbols({}, {}, 5), []);
});
