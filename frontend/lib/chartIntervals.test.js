const assert = require('node:assert/strict');
const { test } = require('node:test');

test('chart intervals only expose provider-supported values', async () => {
  const { SUPPORTED_CHART_INTERVALS, isSupportedChartInterval } = await import('./chartIntervals.ts');
  assert.ok(SUPPORTED_CHART_INTERVALS.some((item) => item.id === '4h'));
  assert.equal(isSupportedChartInterval('2w'), false);
});
