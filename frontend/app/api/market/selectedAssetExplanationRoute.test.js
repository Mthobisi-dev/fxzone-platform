const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');

const routePath = path.join(__dirname, 'explanation', '[symbol]', 'route.ts');

test('selected-asset explanation route validates symbols and returns no-store responses', () => {
  const route = fs.readFileSync(routePath, 'utf8');

  assert.match(route, /SUPPORTED_ASSETS\.find/);
  assert.match(route, /getUserFromRequest/);
  assert.match(route, /apiError\('UNAUTHORIZED'/);
  assert.match(route, /apiError\('NOT_FOUND'/);
  assert.match(route, /'Cache-Control': 'no-store'/);
  assert.match(route, /buildSelectedAssetExplanation/);
  assert.doesNotMatch(route, /ai\/sentiment/);
});
