const { test } = require('node:test');
const assert = require('node:assert/strict');

async function loadTechnicalAnalysis() {
  return import('./technicalAnalysis.ts');
}

test('calculates deterministic technical values from supplied OHLC candles', async () => {
  const { calculateTechnicalAnalysis } = await loadTechnicalAnalysis();
  const candles = Array.from({ length: 40 }, (_, index) => {
    const close = 100 + index;
    return {
      time: index,
      open: close - 0.5,
      high: close + 1,
      low: close - 1,
      close,
      volume: 1_000 + index,
    };
  });

  const analysis = calculateTechnicalAnalysis(candles);

  assert.equal(analysis.status, 'available');
  assert.equal(analysis.sma20, 129.5);
  assert.equal(analysis.ema20, 129.5);
  assert.equal(analysis.rsi14, 100);
  assert.equal(analysis.atr14, 2);
  assert.equal(analysis.support20, 119);
  assert.equal(analysis.resistance20, 140);
  assert.ok(Number.isFinite(analysis.macd));
  assert.ok(Number.isFinite(analysis.macdSignal));
});

test('returns insufficient_data instead of manufacturing technical values', async () => {
  const { calculateTechnicalAnalysis } = await loadTechnicalAnalysis();
  const analysis = calculateTechnicalAnalysis([{ time: 1, open: 1, high: 2, low: 0.5, close: 1.5, volume: null }]);

  assert.deepEqual(analysis, { status: 'insufficient_data' });
});
