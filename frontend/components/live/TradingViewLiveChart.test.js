const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');

test('live sessions embed a real TradingView widget and keep chart controls host-owned', () => {
  const source = fs.readFileSync(path.join(__dirname, 'TradingViewLiveChart.tsx'), 'utf8');
  assert.match(source, /www\.tradingview\.com\/widgetembed/);
  assert.match(source, /Choose live chart asset/);
  assert.match(source, /disabled=\{!isHost\}/);
  assert.match(source, /Share screen/);
});

test('live chart provides explicit minimize and maximize controls', () => {
  const source = fs.readFileSync(path.join(__dirname, 'TradingViewLiveChart.tsx'), 'utf8');
  assert.match(source, /Minimize live chart/);
  assert.match(source, /Maximize live chart/);
  assert.match(source, /fixed inset-3 z-\[80\]/);
});