const { test } = require('node:test');
const assert = require('node:assert/strict');
const { broadcastCaptureOptions, supportsScreenShare } = require('./broadcastMedia.ts');

test('screen capture prefers the entire display so a host can navigate between FxZone pages', () => {
  const options = broadcastCaptureOptions();

  assert.equal(options.video.displaySurface, 'monitor');
  assert.equal(options.surfaceSwitching, 'include');
});

test('screen share availability follows the current browser media API', () => {
  assert.equal(supportsScreenShare(undefined), false);
  assert.equal(supportsScreenShare({}), false);
  assert.equal(supportsScreenShare({ getDisplayMedia() {} }), true);
});
