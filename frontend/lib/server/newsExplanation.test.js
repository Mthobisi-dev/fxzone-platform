const assert = require('node:assert/strict');
const { test } = require('node:test');

test('headline-only news never asks AI to invent missing article context', async () => {
  const { buildNewsExplanation } = await import('./newsExplanation.ts');
  let called = false;
  const result = await buildNewsExplanation({
    title: 'Provider publishes a market update',
    content: '',
    source: 'Example News',
    publishedAt: '2026-10-15T10:00:00.000Z',
    assetTags: ['NVDA'],
  }, async () => {
    called = true;
    return 'Invented context';
  });

  assert.equal(called, false);
  assert.equal(result.isAiGenerated, false);
  assert.equal(result.source, 'verified_data');
  assert.match(result.explanation, /article body is not available/i);
});

test('news AI receives provider evidence and safe output is labelled', async () => {
  const { buildNewsExplanation } = await import('./newsExplanation.ts');
  let prompt = '';
  const result = await buildNewsExplanation({
    title: 'Company publishes quarterly operating update',
    content: 'The provider summary says the company reported higher revenue and described its latest operating priorities.',
    source: 'Example News',
    publishedAt: '2026-10-15T10:00:00.000Z',
    assetTags: ['TEST'],
  }, async (request) => {
    prompt = request.prompt;
    return 'The provider reports higher revenue and an update to the company’s operating priorities. Readers can open the original report for its complete definitions and context.';
  });

  assert.match(prompt, /Example News/);
  assert.match(prompt, /higher revenue/);
  assert.equal(result.isAiGenerated, true);
  assert.equal(result.source, 'ai_gateway');
});

test('news AI trading instructions are rejected in favor of provider context', async () => {
  const { buildNewsExplanation } = await import('./newsExplanation.ts');
  const result = await buildNewsExplanation({
    title: 'Company publishes quarterly operating update',
    content: 'The provider summary says the company reported higher revenue and described its latest operating priorities.',
    source: 'Example News',
    publishedAt: null,
    assetTags: [],
  }, async () => 'You should buy the shares because this guarantees a gain for investors.');

  assert.equal(result.isAiGenerated, false);
  assert.equal(result.source, 'verified_data');
  assert.doesNotMatch(result.explanation, /should buy/i);
});

