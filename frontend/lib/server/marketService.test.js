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
