const { test } = require('node:test');
const assert = require('node:assert/strict');

async function loadTradingView() {
  return import('./tradingView.ts');
}

test('maps supported market symbols to honest TradingView chart links', async () => {
  const { getTradingViewChartUrl } = await loadTradingView();

  assert.equal(getTradingViewChartUrl('EURUSD'), 'https://www.tradingview.com/chart/?symbol=FX%3AEURUSD');
  assert.equal(getTradingViewChartUrl('BTCUSD'), 'https://www.tradingview.com/chart/?symbol=COINBASE%3ABTCUSD');
  assert.equal(getTradingViewChartUrl('XAUUSD'), 'https://www.tradingview.com/chart/?symbol=OANDA%3AXAUUSD');
  assert.equal(getTradingViewChartUrl('NVDA'), 'https://www.tradingview.com/chart/?symbol=NVDA');
  assert.equal(getTradingViewChartUrl('not valid!'), null);
});
