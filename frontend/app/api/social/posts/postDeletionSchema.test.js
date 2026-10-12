const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const postsDirectory = __dirname;

test('post deletion routes only clean up relations created by the active schema', () => {
  const singlePostRoute = fs.readFileSync(path.join(postsDirectory, '[id]', 'route.ts'), 'utf8');
  const purgeRoute = fs.readFileSync(path.join(postsDirectory, 'purge-all', 'route.ts'), 'utf8');

  for (const route of [singlePostRoute, purgeRoute]) {
    assert.doesNotMatch(route, /\.from\(['\"]post_reactions['\"]\)/);
    assert.match(route, /\.from\(['\"]reactions['\"]\)/);
    assert.doesNotMatch(route, /Promise\.allSettled/);
    assert.match(route, /dependencyResults\.find\(\(result\) => result\.error\)/);
  }
});
