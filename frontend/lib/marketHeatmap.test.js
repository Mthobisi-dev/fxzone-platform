const { test } = require('node:test');
const assert = require('node:assert/strict');

async function loadHeatmap() {
  return import('./marketHeatmap.ts');
}

test('groups verified market rows into neutral asset-class panels', async () => {
  const { groupMarketHeatmapRows } = await loadHeatmap();
  const groups = groupMarketHeatmapRows([
    { id: 'nvda', symbol: 'NVDA', name: 'NVIDIA', assetType: 'stock', quote: { price: 120, change_pct: 1.4 } },
    { id: 'btc', symbol: 'BTCUSD', name: 'Bitcoin', assetType: 'crypto', quote: { price: 65000, change_pct: -0.4 } },
    { id: 'eur', symbol: 'EURUSD', name: 'Euro / US Dollar', assetType: 'forex', quote: null },
  ]);

  assert.deepEqual(groups.map((group) => [group.id, group.label, group.rows.map((row) => row.symbol)]), [
    ['stock', 'US equities', ['NVDA']],
    ['crypto', 'Crypto', ['BTCUSD']],
    ['forex', 'Forex', ['EURUSD']],
  ]);
});

test('uses change direction for heat-map color and keeps unavailable quotes neutral', async () => {
  const { marketHeatTone } = await loadHeatmap();

  assert.equal(marketHeatTone(3.2), 'gain-strong');
  assert.equal(marketHeatTone(0.2), 'gain');
  assert.equal(marketHeatTone(-0.2), 'loss');
  assert.equal(marketHeatTone(-3.2), 'loss-strong');
  assert.equal(marketHeatTone(null), 'unavailable');
});

test('only enlarges a tile when a provider supplies comparable volume', async () => {
  const { marketHeatTileSize } = await loadHeatmap();

  assert.equal(marketHeatTileSize({ quote: { volume: 1_000 } }, 1_000), 'feature');
  assert.equal(marketHeatTileSize({ quote: { volume: 220 } }, 1_000), 'standard');
  assert.equal(marketHeatTileSize({ quote: { volume: null } }, 1_000), 'standard');
  assert.equal(marketHeatTileSize({ quote: null }, 1_000), 'standard');
});
