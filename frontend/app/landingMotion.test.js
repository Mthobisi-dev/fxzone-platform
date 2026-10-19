const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');

const appDirectory = __dirname;

test('the live logo respects a user preference for reduced motion', () => {
  const styles = fs.readFileSync(path.join(appDirectory, 'globals.css'), 'utf8');

  assert.match(styles, /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*?\.fxzone-live-mark\s+\.fxzone-live-body[\s\S]*?animation:\s*none\s*!important/);
  assert.doesNotMatch(styles, /fxzone-live-mark--force-motion/);
});
