const { test } = require('node:test');
const assert = require('node:assert/strict');

async function loadDashboardFilters() {
  return import('./marketDashboard.ts');
}

const rows = [
  { id: 'nvda', symbol: 'NVDA', name: 'NVIDIA Corporation', assetType: 'stock', quote: { price: 42, change_pct: 3 } },
  { id: 'aapl', symbol: 'AAPL', name: 'Apple Inc.', assetType: 'stock', quote: { price: 220, change_pct: -2 } },
  { id: 'btc', symbol: 'BTCUSD', name: 'Bitcoin', assetType: 'crypto', quote: { price: 70_000, change_pct: 4 } },
  { id: 'eurusd', symbol: 'EURUSD', name: 'Euro / US Dollar', assetType: 'forex', quote: { price: 1.09, change_pct: -0.2 } },
  { id: 'gold', symbol: 'XAUUSD', name: 'Gold Spot / US Dollar', assetType: 'commodity', quote: null },
];

test('applies market, price, change, and search filters only to available provider quotes', async () => {
  const { filterMarketDashboardRows } = await loadDashboardFilters();

  const filtered = filterMarketDashboardRows(rows, {
    market: 'stock',
    price: 'under_50',
    change: 'gainers',
    search: 'nvidia',
  });

  assert.deepEqual(filtered.map((row) => row.symbol), ['NVDA']);
});

test('keeps unavailable instruments visible when no numeric filters are active', async () => {
  const { filterMarketDashboardRows } = await loadDashboardFilters();

  const filtered = filterMarketDashboardRows(rows, {
    market: 'all',
    price: 'all',
    change: 'all',
    search: '',
  });

  assert.equal(filtered.length, 5);
  assert.equal(filtered.find((row) => row.symbol === 'XAUUSD')?.quote, null);
});
