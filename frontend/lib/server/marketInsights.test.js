const { test } = require('node:test');
const assert = require('node:assert/strict');

async function loadMarketInsights() {
  return import('./marketInsights.ts');
}

test('builds an evidence-backed insight card without a confidence score or trade prediction', async () => {
  const { buildMarketInsight } = await loadMarketInsights();
  const insight = buildMarketInsight({
    symbol: 'NVDA',
    name: 'NVIDIA Corporation',
    quote: {
      price: 140,
      change_pct: 1.25,
      timestamp: '2026-10-09T10:00:00.000Z',
      data_source: 'twelve_data',
      freshness: 'live',
    },
    technical: {
      status: 'available',
      sma20: 130,
      ema20: 132,
      rsi14: 61.5,
      macd: 2.5,
      macdSignal: 1.8,
      macdHistogram: 0.7,
      atr14: 3.2,
      support20: 124,
      resistance20: 145,
    },
  });

  assert.equal(insight.status, 'available');
  assert.equal(insight.direction, 'up');
  assert.equal(insight.price, 140);
  assert.equal('confidence' in insight, false);
  assert.match(insight.highlights.join(' '), /RSI \(14\): 61.50/);
  assert.doesNotMatch(insight.highlights.join(' '), /order block|MVRV|target/i);
});

test('withholds technical claims when verified candles are unavailable', async () => {
  const { buildMarketInsight } = await loadMarketInsights();
  const insight = buildMarketInsight({
    symbol: 'XAUUSD',
    name: 'Gold Spot / US Dollar',
    quote: null,
    technical: { status: 'insufficient_data' },
  });

  assert.equal(insight.status, 'unavailable');
  assert.deepEqual(insight.highlights, []);
  assert.match(insight.summary, /unavailable/i);
});
