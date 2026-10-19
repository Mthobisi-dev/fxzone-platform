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

test('landing keeps account access and product context on narrow screens while keeping decoration inert', () => {
  const page = fs.readFileSync(path.join(appDirectory, 'page.tsx'), 'utf8');

  assert.match(page, /href="\/login"/);
  assert.match(page, /href="\/register"/);
  assert.match(page, /Market intelligence, in one place/);
  assert.match(page, /fxzone-landing-watermark pointer-events-none/);
  assert.match(page, /animate=\{reduceMotion \? undefined/);
  assert.doesNotMatch(page, /fxzone-live-mark--force-motion/);
});
