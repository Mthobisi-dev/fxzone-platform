const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');

test('Discover shows trending provider news and no longer exposes group creation', () => {
  const source = fs.readFileSync(path.join(__dirname, '(dashboard)', 'discover', 'page.tsx'), 'utf8');

  assert.match(source, /\/api\/news\/feed\?limit=8/);
  assert.match(source, /Trending market news/);
  assert.match(source, /\/api\/news\/explanation/);
  assert.match(source, /Explain news/);
  assert.doesNotMatch(source, /Discover Traders/);
  assert.doesNotMatch(source, /Create Group/);
});

test('system navigation keeps accessible icon links without visible page labels or mobile profile', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'components', 'layout', 'Sidebar.tsx'), 'utf8');

  assert.match(source, /aria-label=\{item\.label\}/);
  assert.doesNotMatch(source, /<span className="truncate max-w-\[55px\]/);
  assert.doesNotMatch(source, /pathname\.startsWith\('\/profile'\)/);
});

