const { test } = require('node:test');
const assert = require('node:assert/strict');

async function loadDiscoverSearch() {
  return import('./discoverSearch.ts');
}

test('keeps Discover empty until a useful search is entered', async () => {
  const { normalizeDiscoverQuery, shouldSearchDiscover } = await loadDiscoverSearch();

  assert.equal(shouldSearchDiscover(normalizeDiscoverQuery('')), false);
  assert.equal(shouldSearchDiscover(normalizeDiscoverQuery(' a ')), false);
  assert.equal(shouldSearchDiscover(normalizeDiscoverQuery(' alex ')), true);
});

test('bounds and normalizes a Discover query before it reaches APIs', async () => {
  const { normalizeDiscoverQuery } = await loadDiscoverSearch();

  assert.equal(normalizeDiscoverQuery('  @Alex   Rivera  '), '@Alex Rivera');
  assert.equal(normalizeDiscoverQuery('x'.repeat(120)).length, 80);
});
