const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');

test('extracts canonical known asset tags once per post', async () => {
  const { extractPostAssetTags } = await import('./postAssetTags.ts');
  assert.deepEqual(
    extractPostAssetTags('Watching $nvda, NVDA and EUR/USD today', new Set(['NVDA', 'EURUSD'])),
    ['NVDA', 'EURUSD']
  );
});

test('unread badge labels are bounded and hidden at zero', async () => {
  const { getUnreadBadgeLabel } = await import('./postAssetTags.ts');
  assert.equal(getUnreadBadgeLabel(0), null);
  assert.equal(getUnreadBadgeLabel(4), '4');
  assert.equal(getUnreadBadgeLabel(120), '99+');
});

test('composer no longer presents the optional caption prompt', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'components/social/PostComposer.tsx'), 'utf8');
  assert.doesNotMatch(source, /add a caption \(optional\)/i);
});

test('light theme keeps the wordmark on a semantic strong-text token', () => {
  const styles = fs.readFileSync(path.join(__dirname, '..', 'app', 'globals.css'), 'utf8');
  assert.match(styles, /\.theme-minimal-light[\s\S]*?--fx-text-strong:\s*#0f172a/);
});

test('navigation renders a chat unread badge without changing the icon layout', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'components/layout/Sidebar.tsx'), 'utf8');
  assert.match(source, /getUnreadBadgeLabel\(totalChatUnreadCount\)/);
  assert.match(source, /unread messages/);
});
