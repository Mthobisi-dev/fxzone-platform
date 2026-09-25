const test = require('node:test');
const assert = require('node:assert/strict');
const { createNotification } = require('./notifications.js');

test('stores a recipient notification as unread', async () => {
  let inserted;
  const db = {
    from: (table) => ({
      insert: async (payload) => {
        assert.equal(table, 'notifications');
        inserted = payload;
        return { error: null };
      },
    }),
  };

  const created = await createNotification(db, {
    recipientId: 'recipient-id',
    actorId: 'actor-id',
    type: 'like',
    title: 'New like',
    message: 'A trader liked your post.',
    data: { post_id: 'post-id' },
  });

  assert.equal(created, true);
  assert.deepEqual(inserted, {
    user_id: 'recipient-id',
    type: 'like',
    title: 'New like',
    message: 'A trader liked your post.',
    data: { post_id: 'post-id' },
    is_read: false,
  });
});

test('does not create a notification for the actor', async () => {
  let wrote = false;
  const db = { from: () => ({ insert: async () => { wrote = true; return { error: null }; } }) };

  const created = await createNotification(db, {
    recipientId: 'same-user', actorId: 'same-user', type: 'like', title: 'New like', message: 'Ignored',
  });

  assert.equal(created, false);
  assert.equal(wrote, false);
});

test('does not make the completed activity fail when notification storage is unavailable', async () => {
  const db = { from: () => ({ insert: async () => ({ error: new Error('relation missing') }) }) };
  const created = await createNotification(db, {
    recipientId: 'recipient-id', actorId: 'actor-id', type: 'comment', title: 'New comment', message: 'Hello',
  });

  assert.equal(created, false);
});
test('handles a rejected notification write without rejecting the activity', async () => {
  const db = { from: () => ({ insert: async () => { throw new Error('network unavailable'); } }) };
  const created = await createNotification(db, {
    recipientId: 'recipient-id', actorId: 'actor-id', type: 'follow', title: 'New follower', message: 'Hello',
  });

  assert.equal(created, false);
});
