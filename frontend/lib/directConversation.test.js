const assert = require('node:assert/strict');
const { test } = require('node:test');

test('canonical direct pair is stable and rejects self chat', async () => {
  const { canonicalDirectPair } = await import('./directConversation.ts');
  assert.deepEqual(canonicalDirectPair('user-b', 'user-a'), ['user-a', 'user-b']);
  assert.throws(() => canonicalDirectPair('user-a', 'user-a'), /different users/);
});

test('deduplicates direct conversations by unordered participant pair', async () => {
  const { dedupeDirectConversations } = await import('./directConversation.ts');
  const items = [
    { id: 'new', is_group: false, members: [{ id: 'b' }, { id: 'a' }] },
    { id: 'old', is_group: false, members: [{ id: 'a' }, { id: 'b' }] },
    { id: 'group', is_group: true, members: [{ id: 'a' }, { id: 'b' }, { id: 'c' }] },
  ];
  assert.deepEqual(dedupeDirectConversations(items), [items[0], items[2]]);
});

test('unread aggregation ignores invalid values and removes only the requested thread', async () => {
  const { getConversationUnreadCount, removeConversationById } = await import('./directConversation.ts');
  assert.equal(getConversationUnreadCount([{ unreadCount: 2 }, { unreadCount: '3' }, { unreadCount: -4 }, { unreadCount: 'bad' }]), 5);
  assert.deepEqual(removeConversationById([{ id: 'one' }, { id: 'two' }], 'one'), [{ id: 'two' }]);
});
