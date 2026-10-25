const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const routeSource = () => fs.readFileSync(path.join(__dirname, 'route.ts'), 'utf8');

test('profile updates use explicit public fields even on legacy broker schemas', () => {
  const source = routeSource();

  assert.match(source, /const PROFILE_COLUMNS_LEGACY\s*=/);
  assert.match(source, /\.select\(PROFILE_COLUMNS_LEGACY\)/);
  assert.doesNotMatch(source, /\.select\(\)\s*\.maybeSingle\(\)/);
});

test('account deletion fails safely when required cleanup cannot complete', () => {
  const source = routeSource();

  assert.match(source, /if \(delErr\) \{/);
  assert.match(source, /ACCOUNT_DELETE_FAILED/);
  assert.match(source, /followDeleteErrors/);
  assert.match(source, /ACCOUNT_DELETE_PARTIAL/);
});

test('profile errors do not expose raw database messages to clients', () => {
  const source = routeSource();

  assert.doesNotMatch(source, /detail:\s*err\?\.message/);
  assert.doesNotMatch(source, /detail:\s*updateError\.message/);
});
