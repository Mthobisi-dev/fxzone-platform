const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');

const appDirectory = __dirname;

test('the requested live logo motion is not disabled by Windows reduced-motion media settings', () => {
  const page = fs.readFileSync(path.join(appDirectory, 'page.tsx'), 'utf8');
  const styles = fs.readFileSync(path.join(appDirectory, 'globals.css'), 'utf8');

  assert.match(page, /fxzone-live-mark--force-motion/);
  assert.match(styles, /fxzone-live-mark:not\(\.fxzone-live-mark--force-motion\)/);
});
