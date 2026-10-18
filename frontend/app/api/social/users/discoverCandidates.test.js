const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('Discover excludes accounts already followed before it applies pagination', () => {
  const route = fs.readFileSync(path.join(__dirname, 'route.ts'), 'utf8');

  assert.match(route, /const followingIds = new Set/);
  assert.match(route, /query = query\.not\('id', 'in', `\(\$\{Array\.from\(followingIds\)/);
  assert.match(route, /\.limit\(Math\.min\(limit \+ LEGACY_DEMO_USERNAMES\.size \+ 1, 100\)\)/);
});
