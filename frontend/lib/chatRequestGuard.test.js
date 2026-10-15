const { test } = require('node:test');
const assert = require('node:assert/strict');

test('an older poll cannot restore a deleted message or overwrite a newer response', async () => {
  const { ChatRequestGuard } = await import('./chatRequestGuard.ts');
  const guard = new ChatRequestGuard();
  guard.activate('chat-a');
  const beforeDelete = guard.begin('chat-a');
  guard.invalidate('chat-a');
  assert.equal(beforeDelete(), false);
  const older = guard.begin('chat-a');
  const newer = guard.begin('chat-a');
  assert.equal(older(), false);
  assert.equal(newer(), true);
});

test('requests cannot replace a different conversation, including navigating away and back', async () => {
  const { ChatRequestGuard } = await import('./chatRequestGuard.ts');
  const guard = new ChatRequestGuard();
  guard.activate('chat-a');
  const original = guard.begin('chat-a');
  guard.activate('chat-b');
  assert.equal(original(), false);
  const current = guard.begin('chat-b');
  assert.equal(guard.begin('chat-a')(), false);
  guard.invalidate('chat-a'); // A deletion finishing in another chat must not disrupt this one.
  assert.equal(current(), true);
  guard.activate('chat-a');
  assert.equal(original(), false);
  assert.equal(current(), false);
});
