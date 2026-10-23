const { test } = require('node:test');
const assert = require('node:assert/strict');
const { canAcceptLiveChartContext, canControlLiveChart, isLiveChartControlEventFromHost } = require('./liveChartControl.ts');

test('host and delegated viewer can control the live chart', () => {
  assert.equal(canControlLiveChart({ viewerId: 'host', hostId: 'host', controllerId: null }), true);
  assert.equal(canControlLiveChart({ viewerId: 'viewer', hostId: 'host', controllerId: 'viewer' }), true);
  assert.equal(canControlLiveChart({ viewerId: 'other', hostId: 'host', controllerId: 'viewer' }), false);
  assert.equal(canControlLiveChart({ viewerId: '', hostId: 'host', controllerId: null }), false);
});

test('chart context accepts only the host or delegated controller', () => {
  assert.equal(canAcceptLiveChartContext({ senderId: 'host', hostId: 'host', controllerId: 'viewer' }), true);
  assert.equal(canAcceptLiveChartContext({ senderId: 'viewer', hostId: 'host', controllerId: 'viewer' }), true);
  assert.equal(canAcceptLiveChartContext({ senderId: 'other', hostId: 'host', controllerId: 'viewer' }), false);
});

test('chart-control assignments can only originate from the host', () => {
  assert.equal(isLiveChartControlEventFromHost('host', 'host'), true);
  assert.equal(isLiveChartControlEventFromHost('viewer', 'host'), false);
});