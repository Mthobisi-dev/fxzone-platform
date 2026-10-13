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
