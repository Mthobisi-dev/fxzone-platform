const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('notification reads expose only the client notification contract', () => {
  const source = fs.readFileSync(path.join(__dirname, 'route.ts'), 'utf8');

  assert.match(source, /const NOTIFICATION_COLUMNS\s*=/);
  assert.match(source, /\.select\(NOTIFICATION_COLUMNS\)/);
  assert.doesNotMatch(source, /\.select\('\*'\)/);
});
