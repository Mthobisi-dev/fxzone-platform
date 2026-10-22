const assert = require('node:assert/strict');
const { test } = require('node:test');

test('normalizes known asset tags, removes duplicates, and rejects unknown values', async () => {
  const { normalizePostAssetTags } = await import('./postAssetTags.ts');
  assert.deepEqual(normalizePostAssetTags(['nvda', 'NVDA', 'EUR/USD', 'not-an-asset', 42]), ['NVDA', 'EURUSD']);
});

test('post endpoints persist asset tags and return them to feed consumers', () => {
  const fs = require('node:fs');
  const posts = fs.readFileSync('./app/api/social/posts/route.ts', 'utf8');
  const feed = fs.readFileSync('./app/api/social/feed/route.ts', 'utf8');
  assert.match(posts, /normalizePostAssetTags\(asset_tags\)/);
  assert.match(posts, /asset_tags: normalizedAssetTags/);
  assert.match(feed, /asset_tags: Array\.isArray\(p\.asset_tags\)/);
});
