const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');

const componentPath = path.join(__dirname, 'VerifiedAssetDetail.tsx');

test('selected-instrument detail loads an abortable asset-specific AI explanation', () => {
  const component = fs.readFileSync(componentPath, 'utf8');

  assert.match(component, /\/api\/market\/explanation\/\$\{asset\.symbol\}/);
  assert.match(component, /AbortController/);
  assert.match(component, /AI research explanation/);
  assert.match(component, /research\.map/);
  assert.match(component, /Research details/);
  assert.match(component, /AI-generated explanation/);
  assert.doesNotMatch(component, /ai\/sentiment/);
});

test('selected-instrument detail keeps provider provenance and dense values readable on small screens', () => {
  const component = fs.readFileSync(componentPath, 'utf8');

  assert.match(component, /Provider history/);
  assert.match(component, /fx-data/);
  assert.match(component, /overflow-x-auto/);
  assert.match(component, /sm:grid-cols/);
});

test('live market workspace keeps real-data controls compact and theme-aware', () => {
  const screener = fs.readFileSync(path.join(__dirname, 'LiveMarketScreener.tsx'), 'utf8');

  assert.match(screener, /buildMarketScreenerRows/);
  assert.match(screener, /min-h-11/);
  assert.match(screener, /var\(--fx-bg-surface\)/);
  assert.match(screener, /overflow-x-auto/);
});
