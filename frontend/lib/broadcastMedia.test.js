const { test } = require('node:test');
const assert = require('node:assert/strict');
const { supportsScreenShare } = require('./broadcastMedia.ts');
test('screen share availability follows the current browser media API', () => {
  assert.equal(supportsScreenShare(undefined), false);
  assert.equal(supportsScreenShare({}), false);
  assert.equal(supportsScreenShare({ getDisplayMedia() {} }), true);
});
