const assert = require('node:assert/strict');
const { test } = require('node:test');

test('workspace density is bounded to readable layout classes', async () => {
  const { densityClass } = await import('./workspaceDensity.ts');
  assert.match(densityClass('compact'), /density-compact/);
  assert.match(densityClass('comfortable'), /density-comfortable/);
  assert.match(densityClass('spacious'), /density-spacious/);
});
