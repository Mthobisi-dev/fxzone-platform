const { test } = require('node:test');
const assert = require('node:assert/strict');

test('refreshing one thread preserves other threads and optimistic sends', async () => {
  const { mergeConversationMessages } = await import('./chatThreads.ts');
  const message = (id, conversationId) => ({ id, conversationId, content: id, createdAt: '2026-10-17T10:00:00Z' });
  const previous = [message('a1', 'a'), message('b1', 'b'), message('temp-send', 'a')];
  const confirmed = [message('a2', 'a')];
  assert.deepEqual(mergeConversationMessages(previous, confirmed, 'a').map(item => item.id), ['b1', 'a2', 'temp-send']);
  assert.deepEqual(mergeConversationMessages(previous, [], 'a').map(item => item.id), ['b1', 'temp-send']);
  assert.deepEqual(previous.map(item => item.id), ['a1', 'b1', 'temp-send']);
});

test('preview reflects deleted messages while preserving unfetched conversation previews', async () => {
  const { getConversationPreview } = await import('./chatThreads.ts');
  const fallback = { content: 'old', createdAt: '2026-10-17T10:00:00Z' };
  const messages = [{ id: 'b1', conversationId: 'b', content: 'Private B', createdAt: fallback.createdAt }];
  assert.equal(getConversationPreview(messages, 'a', false, fallback), fallback);
  assert.equal(getConversationPreview(messages, 'a', true, fallback), undefined);
  assert.deepEqual(getConversationPreview(messages, 'b', true), { content: 'Private B', createdAt: fallback.createdAt });
});

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
