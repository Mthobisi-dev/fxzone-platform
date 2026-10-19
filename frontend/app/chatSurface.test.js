const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');

const root = path.join(__dirname, '..');

test('chat route removes only the authenticated member and never deletes the conversation', () => {
  const source = fs.readFileSync(path.join(root, 'app', 'api', 'chat', 'conversations', '[id]', 'route.ts'), 'utf8');
  assert.match(source, /export async function DELETE/);
  assert.match(source, /\.eq\('user_id', user\.id\)/);
  assert.doesNotMatch(source, /from\('conversations'\)\.delete/);
});

test('mobile chat shell fills the navigation safe-area and exposes thread removal', () => {
  const page = fs.readFileSync(path.join(root, 'app', '(dashboard)', 'chat', 'page.tsx'), 'utf8');
  const sidebar = fs.readFileSync(path.join(root, 'components', 'chat', 'ChatSidebar.tsx'), 'utf8');
  assert.match(page, /h-\[calc\(100%\+var\(--mobile-nav-height\)\)\]/);
  assert.match(page, /onDeleteConversation=\{handleDeleteConversation\}/);
  assert.match(sidebar, /aria-label=\{`Remove conversation with/);
});
