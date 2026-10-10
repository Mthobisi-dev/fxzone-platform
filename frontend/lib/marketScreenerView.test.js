const { test } = require('node:test');
const assert = require('node:assert/strict');

async function loadScreenerView() {
  return import('./marketScreenerView.ts');
}

test('the switchable screener list keeps filtered instruments in category order', async () => {
  const { groupScreenerListRows } = await loadScreenerView();

  const groups = groupScreenerListRows([
    { id: 'eur', symbol: 'EURUSD', name: 'Euro / US Dollar', assetType: 'forex', quote: null },
    { id: 'btc', symbol: 'BTCUSD', name: 'Bitcoin', assetType: 'crypto', quote: { price: 65000, change_pct: 2 } },
    { id: 'nvda', symbol: 'NVDA', name: 'NVIDIA', assetType: 'stock', quote: { price: 200, change_pct: -1 } },
  ]);

  assert.deepEqual(groups.map((group) => [group.id, group.rows.map((row) => row.symbol)]), [
    ['stock', ['NVDA']],
    ['crypto', ['BTCUSD']],
    ['forex', ['EURUSD']],
  ]);
  assert.equal(groups[2].rows[0].quote, null);
});
