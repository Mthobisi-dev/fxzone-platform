const assert = require('node:assert/strict');
const { test } = require('node:test');

test('structured signals validate known provider instruments and remain bounded', async () => {
  const { validateShareSignal, serializeShareSignal, parseSerializedShareSignal } = await import('./shareSignal.ts');
  const signal = validateShareSignal({ symbol: 'XAUUSD', interval: '1h', side: 'BUY', entry: 100, takeProfit: 110, stopLoss: 95, provider: 'Yahoo Finance', timestamp: '2026-10-19T10:00:00Z', rationale: 'breakout' });
  const serialized = serializeShareSignal(signal);
  assert.match(serialized, /\[FxZone Signal\]/);
  assert.deepEqual(parseSerializedShareSignal(serialized), signal);
  assert.equal(parseSerializedShareSignal('[FxZone Signal] {"symbol":"FAKE"}'), null);
  assert.throws(() => validateShareSignal({ ...signal, symbol: 'FAKE' }), /invalid/);
  assert.throws(() => validateShareSignal({ ...signal, entry: 0 }), /positive/);
});
