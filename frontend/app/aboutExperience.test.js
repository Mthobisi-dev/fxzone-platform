const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');

test('landing footer links to the About page beside the legal links', () => {
  const page = fs.readFileSync(path.join(__dirname, 'page.tsx'), 'utf8');
  assert.match(page, /href="\/about"[^>]*>About<\/Link>/);
  assert.match(page, /href="\/terms"/);
  assert.match(page, /href="\/privacy"/);
  assert.match(page, /href="\/risk-disclosure"/);
});

test('About page explains the product and its research-only scope', () => {
  const page = fs.readFileSync(path.join(__dirname, 'about/page.tsx'), 'utf8');
  assert.match(page, /Market research, organised/);
  assert.match(page, /provider-supplied quotes/);
  assert.match(page, /does not execute trades/);
  assert.match(page, /href="\/risk-disclosure"/);
});
