const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('profile provisioning does not treat a lookup error as a missing profile', () => {
  const source = fs.readFileSync(path.join(__dirname, 'supabaseServer.ts'), 'utf8');

  assert.match(source, /const \{ data: existing, error: existingError \}/);
  assert.match(source, /if \(existingError\) throw existingError/);
});
