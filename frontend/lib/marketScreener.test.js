const { test } = require('node:test');
const assert = require('node:assert/strict');

async function loadScreener() {
  return import('./marketScreener.ts');
}

test('market screener never invents a quote for an asset without provider data', async () => {
  const { buildMarketScreenerRows } = await loadScreener();

  const rows = buildMarketScreenerRows([
    { id: 'asset-nvda', symbol: 'NVDA', name: 'NVIDIA', asset_type: 'stock', is_active: true },
  ], {});

  assert.deepEqual(rows, [{
    id: 'asset-nvda',
    symbol: 'NVDA',
    name: 'NVIDIA',
    assetType: 'stock',
    quote: null,
  }]);
});

test('market screener preserves a real provider quote and its quality metadata', async () => {
  const { buildMarketScreenerRows } = await loadScreener();
  const quote = {
    symbol: 'BTCUSD',
    price: 65000,
    change: 1200,
    change_pct: 1.88,
    timestamp: '2026-10-09T10:00:00.000Z',
    data_source: 'coingecko',
    freshness: 'live',
    is_stale: false,
    is_live: true,
  };

  const [row] = buildMarketScreenerRows([
    { id: 'asset-btc', symbol: 'BTCUSD', name: 'Bitcoin', asset_type: 'crypto', is_active: true },
  ], { BTCUSD: quote });

  assert.equal(row.quote, quote);
  assert.equal(row.quote.price, 65000);
  assert.equal(row.quote.is_live, true);
});
