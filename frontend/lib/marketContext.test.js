const { test } = require('node:test');
const assert = require('node:assert/strict');

async function loadMarketContext() {
  return import('./marketContext.ts');
}

const assets = [
  { id: 'nvda', symbol: 'NVDA', name: 'NVIDIA', asset_type: 'stock', is_active: true },
  { id: 'btc', symbol: 'BTCUSD', name: 'Bitcoin', asset_type: 'crypto', is_active: true },
  { id: 'eur', symbol: 'EURUSD', name: 'Euro / US Dollar', asset_type: 'forex', is_active: true },
  { id: 'gold', symbol: 'XAUUSD', name: 'Gold Spot / US Dollar', asset_type: 'commodity', is_active: true },
];

const prices = {
  NVDA: { symbol: 'NVDA', price: 200, change: 2, change_pct: 1, timestamp: '2026-10-09T10:00:00.000Z', data_source: 'yahoo_finance', freshness: 'delayed', is_live: false, is_stale: false, open: 198, high: 201, low: 197, volume: 100 },
  BTCUSD: { symbol: 'BTCUSD', price: 65000, change: 1200, change_pct: 1.88, timestamp: '2026-10-09T10:00:00.000Z', data_source: 'coingecko', freshness: 'live', is_live: true, is_stale: false, open: null, high: null, low: null, volume: 200 },
};

test('keeps every active asset in its explicit verified-market category', async () => {
  const { groupVerifiedMarketContext } = await loadMarketContext();

  const groups = groupVerifiedMarketContext(assets, prices);

  assert.deepEqual(groups.map((group) => [group.id, group.label, group.assets.map((asset) => asset.symbol)]), [
    ['stock', 'US equities', ['NVDA']],
    ['crypto', 'Crypto', ['BTCUSD']],
    ['forex', 'Forex', ['EURUSD']],
    ['commodity', 'Metals', ['XAUUSD']],
  ]);
  assert.equal(groups.find((group) => group.id === 'forex')?.availableCount, 0);
  assert.equal(groups.find((group) => group.id === 'stock')?.availableCount, 1);
});

test('builds an asset detail from supplied provider fields without manufacturing missing values', async () => {
  const { buildVerifiedAssetDetail } = await loadMarketContext();

  const detail = buildVerifiedAssetDetail(assets[1], prices.BTCUSD);

  assert.deepEqual(detail, {
    symbol: 'BTCUSD',
    name: 'Bitcoin',
    assetType: 'crypto',
    price: 65000,
    changePct: 1.88,
    provider: 'coingecko',
    freshness: 'live',
    timestamp: '2026-10-09T10:00:00.000Z',
    open: null,
    high: null,
    low: null,
    volume: 200,
  });
});

test('marks a selected catalogue asset unavailable when no provider quote exists', async () => {
  const { buildVerifiedAssetDetail } = await loadMarketContext();

  const detail = buildVerifiedAssetDetail(assets[2], null);

  assert.equal(detail.price, null);
  assert.equal(detail.provider, null);
  assert.equal(detail.freshness, null);
  assert.equal(detail.volume, null);
});
