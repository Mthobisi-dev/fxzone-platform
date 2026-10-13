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

test('filters only provider-supplied market capitalization and canonical sector classifications', async () => {
  const { filterMarketDashboardRows } = await loadDashboardFilters();
  const filterRows = [
    { id: 'nvda', symbol: 'NVDA', name: 'NVIDIA', assetType: 'stock', sector: 'Information Technology', quote: { price: 140, change_pct: 1, market_cap: 3_400_000_000_000 } },
    { id: 'small', symbol: 'SMALL', name: 'Small Co', assetType: 'stock', sector: 'Industrials', quote: { price: 20, change_pct: 1, market_cap: 5_000_000_000 } },
    { id: 'eur', symbol: 'EURUSD', name: 'Euro', assetType: 'forex', sector: 'Foreign Exchange', quote: { price: 1.1, change_pct: 0.1, market_cap: null } },
  ];
  const filtered = filterMarketDashboardRows(filterRows, {
    market: 'all', price: 'all', change: 'all', search: '', sector: 'Information Technology', marketCap: 'over_100b',
  });

  assert.deepEqual(filtered.map((row) => row.symbol), ['NVDA']);
});
