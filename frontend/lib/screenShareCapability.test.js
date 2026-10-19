const assert = require('node:assert/strict');
const { test } = require('node:test');

test('screen share capability reflects native browser support without starting capture', async () => {
  const { getScreenShareCapability, screenShareUnavailableMessage } = await import('./screenShareCapability.ts');
  assert.equal(getScreenShareCapability({ mediaDevices: { getDisplayMedia() {} }, userAgent: 'Chrome Android' }), 'supported');
  assert.equal(getScreenShareCapability({ mediaDevices: {}, userAgent: 'Safari iPhone' }), 'unsupported');
  assert.equal(getScreenShareCapability({ mediaDevices: { getDisplayMedia() {} }, userAgent: 'Safari iPhone' }), 'restricted');
  assert.match(screenShareUnavailableMessage('restricted'), /restricted/i);
});
