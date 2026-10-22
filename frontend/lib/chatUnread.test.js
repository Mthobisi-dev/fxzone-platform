import test from 'node:test';
import assert from 'node:assert/strict';
import { getChatUnreadBadgeCount } from './chatUnread.ts';

test('chat badge counts each unread conversation once across both state sources', () => {
  assert.equal(
    getChatUnreadBadgeCount(
      [{ id: 'conversation-1', unread_count: 2 }],
      [{ type: 'message', is_read: false, data: { conversation_id: 'conversation-1' } }],
    ),
    1,
  );
});

test('chat badge counts unread message notifications without a conversation id', () => {
  assert.equal(
    getChatUnreadBadgeCount(
      [],
      [{ type: 'message', is_read: false }, { type: 'message', is_read: false }],
    ),
    2,
  );
});

test('read notifications and non-message notifications do not affect the chat badge', () => {
  assert.equal(
    getChatUnreadBadgeCount(
      [{ id: 'conversation-1', unread_count: 0 }],
      [
        { type: 'message', is_read: true, data: { conversation_id: 'conversation-1' } },
        { type: 'follow', is_read: false },
      ],
    ),
    0,
  );
});
