const { test } = require('node:test');
const assert = require('node:assert/strict');

async function loadExplanationService() {
  return import('./selectedAssetExplanation.ts');
}

const availableInsight = {
  symbol: 'NVDA',
  name: 'NVIDIA Corporation',
  status: 'available',
  direction: 'up',
  price: 140,
  changePct: 1.25,
  timestamp: '2026-10-10T12:00:00.000Z',
  dataSource: 'twelve_data',
  freshness: 'live',
  summary: 'NVDA is +1.25% at 140. The values below are calculated from verified historical candles.',
  highlights: ['RSI (14): 61.50.', 'EMA (20): 132.00; SMA (20): 130.00.'],
};

test('uses an AI explanation only when the generated copy stays evidence-safe', async () => {
  const { buildSelectedAssetExplanation } = await loadExplanationService();
  let request;
  const result = await buildSelectedAssetExplanation(availableInsight, async (value) => {
    request = value;
    return 'The latest provider move is positive. The deterministic indicators above give context, but they do not determine an action.';
  });

  assert.equal(result.source, 'ai_gateway');
  assert.equal(result.isAiGenerated, true);
  assert.match(result.explanation, /provider move is positive/i);
  assert.match(request.system, /no numbers/i);
  assert.match(request.prompt, /NVDA/);
  assert.deepEqual(result.research.map((section) => section.id), ['market_snapshot', 'technical_context', 'data_quality']);
  assert.ok(result.research.find((section) => section.id === 'technical_context')?.items.length);
});

test('falls back to a labelled verified-data briefing when generated copy makes a trade claim', async () => {
  const { buildSelectedAssetExplanation } = await loadExplanationService();
  const result = await buildSelectedAssetExplanation(availableInsight, async () => 'Buy now at 140 with 92% confidence.');

  assert.equal(result.source, 'verified_data');
  assert.equal(result.isAiGenerated, false);
  assert.doesNotMatch(result.explanation, /buy now|confidence/i);
  assert.match(result.explanation, /verified/i);
});

test('withholds technical interpretation when historical candles are unavailable', async () => {
  const { buildSelectedAssetExplanation } = await loadExplanationService();
  const result = await buildSelectedAssetExplanation({
    ...availableInsight,
    status: 'insufficient_data',
    highlights: [],
  }, async () => 'The provider update is positive.');

  assert.equal(result.source, 'verified_data');
  assert.equal(result.isAiGenerated, false);
  assert.match(result.explanation, /historical indicators are unavailable/i);
  assert.deepEqual(result.research.map((section) => section.id), ['market_snapshot', 'data_quality']);
});

test('does not call an AI provider when no verified quote is available', async () => {
  const { buildSelectedAssetExplanation } = await loadExplanationService();
  let called = false;
  const result = await buildSelectedAssetExplanation({
    ...availableInsight,
    status: 'unavailable',
    highlights: [],
  }, async () => {
    called = true;
    return 'This must not be used.';
  });

  assert.equal(called, false);
  assert.equal(result.isAiGenerated, false);
  assert.match(result.explanation, /verified quote is unavailable/i);
});
