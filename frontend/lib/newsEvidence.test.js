const assert = require('node:assert/strict');
const { test } = require('node:test');

test('news evidence only contains provider facts and explicit uncertainty', async () => {
  const { buildNewsEvidence } = await import('./newsEvidence.ts');
  const evidence = buildNewsEvidence({ source: 'Reuters', published_at: '2026-10-19T10:00:00Z', asset_tags: ['xauusd', 'XAUUSD'], content: 'Gold rose. Traders monitored rates.' });
  assert.deepEqual(evidence.assets, ['XAUUSD']);
  assert.deepEqual(evidence.facts, ['Gold rose.', 'Traders monitored rates.']);
  assert.deepEqual(evidence.uncertainty, []);
});
