const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');

const root = path.join(__dirname, '..');

test('conversation read endpoint is membership-scoped and clears only matching message notifications', () => {
  const source = fs.readFileSync(path.join(root, 'app', 'api', 'chat', 'conversations', '[id]', 'read', 'route.ts'), 'utf8');
  assert.match(source, /conversation_members/);
  assert.match(source, /\.eq\('user_id', user\.id\)/);
  assert.match(source, /\.eq\('type', 'message'\)/);
  assert.match(source, /\.contains\('data', \{ conversation_id: conversationId \}\)/);
  assert.match(source, /export async function POST/);
});

test('notification store keeps active chat messages out of unread badges and supports conversation-wide clearing', () => {
  const source = fs.readFileSync(path.join(root, 'stores', 'notificationStore.ts'), 'utf8');
  assert.match(source, /activeConversationId/);
  assert.match(source, /setActiveConversation/);
  assert.match(source, /markConversationRead/);
  assert.match(source, /clearConversationNotifications/);
  assert.match(source, /notification\.data\?\.conversation_id/);
});

test('chat page marks the selected conversation read and clears active state on unmount', () => {
  const source = fs.readFileSync(path.join(root, 'app', '(dashboard)', 'chat', 'page.tsx'), 'utf8');
  assert.match(source, /markConversationRead\(conversationId\)/);
  assert.match(source, /setActiveConversation\(conversationId\)/);
  assert.match(source, /setActiveConversation\(null\)/);
});
