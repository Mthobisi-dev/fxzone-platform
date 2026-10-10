const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');

const stylesPath = path.join(__dirname, 'globals.css');

test('theme compatibility preserves custom blue component backgrounds', () => {
  const styles = fs.readFileSync(stylesPath, 'utf8');

  assert.doesNotMatch(styles, /\[class\*="bg-\[#0"\]/);
  assert.match(styles, /\[class\*="bg-\[#05070d\]"\]/);
});