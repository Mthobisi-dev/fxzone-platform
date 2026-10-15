const assert = require('node:assert/strict');
const { test } = require('node:test');

async function loadPolicy() {
  return import('./chatMessagePolicy.ts');
}

test('message deletion is limited to the sender and the requested conversation', async () => {
  const { canDeleteMessage } = await loadPolicy();
  const message = { id: 'm-1', conversation_id: 'c-1', sender_id: 'u-1' };

  assert.equal(canDeleteMessage(message, 'u-1', 'c-1'), true);
  assert.equal(canDeleteMessage(message, 'u-2', 'c-1'), false);
  assert.equal(canDeleteMessage(message, 'u-1', 'c-2'), false);
});
