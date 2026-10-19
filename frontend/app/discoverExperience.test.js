const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');

test('Discover shows trending provider news and no longer exposes group creation', () => {
  const source = fs.readFileSync(path.join(__dirname, '(dashboard)', 'discover', 'page.tsx'), 'utf8');

  assert.match(source, /<h1[^>]*>Discover<\/h1>/);
  assert.match(source, /\/api\/social\/users\?limit=3/);
  assert.match(source, /\.slice\(0, 3\)/);
  assert.match(source, /\/api\/news\/feed\?limit=8/);
  assert.match(source, /Trending market news/);
  assert.match(source, /\/api\/news\/explanation/);
  assert.match(source, /Explain news/);
  assert.match(source, /Latest market news/);
  assert.match(source, /article\.media_url/);
  assert.match(source, /article\.media_type\s*===\s*['"]video['"]/);
  assert.doesNotMatch(source, /Discover Traders/);
  assert.doesNotMatch(source, /Create Group/);
  assert.doesNotMatch(source, /Enter at least two characters to search for a trader/);
});

test('Messages uses a mobile viewport shell and compact responsive controls', () => {
  const page = fs.readFileSync(path.join(__dirname, '(dashboard)', 'chat', 'page.tsx'), 'utf8');
  const sidebar = fs.readFileSync(path.join(__dirname, '..', 'components', 'chat', 'ChatSidebar.tsx'), 'utf8');
  const window = fs.readFileSync(path.join(__dirname, '..', 'components', 'chat', 'ChatWindow.tsx'), 'utf8');
  const input = fs.readFileSync(path.join(__dirname, '..', 'components', 'chat', 'MessageInput.tsx'), 'utf8');

  assert.match(page, /fxzone-mobile-chat/);
  assert.match(sidebar, /max-w-full/);
  assert.match(window, /fxzone-chat-mobile-header/);
  assert.match(input, /fxzone-chat-composer/);
  const layout = fs.readFileSync(path.join(__dirname, '(dashboard)', 'layout.tsx'), 'utf8');
  const navigation = fs.readFileSync(path.join(__dirname, '..', 'components', 'layout', 'Sidebar.tsx'), 'utf8');
  assert.match(layout, /pb-\[var\(--mobile-nav-height\)\]/);
  assert.match(navigation, /h-\[var\(--mobile-nav-height\)\]/);
  assert.doesNotMatch(input, /safe-area-inset-bottom/);
});

test('system navigation keeps accessible icon links without visible page labels or mobile profile', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'components', 'layout', 'Sidebar.tsx'), 'utf8');

  assert.match(source, /aria-label=\{item\.label\}/);
  assert.doesNotMatch(source, /<span className="truncate max-w-\[55px\]/);
  assert.doesNotMatch(source, /pathname\.startsWith\('\/profile'\)/);
});

test('social gallery keeps attachment navigation reachable on touch screens', () => {
  const gallery = fs.readFileSync(path.join(__dirname, '..', 'components', 'social', 'PostGallery.tsx'), 'utf8');

  assert.match(gallery, /aria-label=\{`Show attachment/);
  assert.match(gallery, /h-11 w-11/);
  assert.match(gallery, /snap-x snap-mandatory overflow-x-auto/);
});

test('social composition and suggestions retain compact, reachable mobile controls', () => {
  const composer = fs.readFileSync(path.join(__dirname, '..', 'components', 'social', 'PostComposer.tsx'), 'utf8');
  const userCard = fs.readFileSync(path.join(__dirname, '..', 'components', 'social', 'UserCard.tsx'), 'utf8');
  const post = fs.readFileSync(path.join(__dirname, '..', 'components', 'social', 'PostCard.tsx'), 'utf8');

  assert.match(composer, /fxzone-post-composer/);
  assert.match(composer, /min-h-11/);
  assert.match(composer, /overflow-x-auto/);
  assert.match(composer, /var\(--fx-text-strong\)/);
  assert.match(userCard, /min-h-11/);
  assert.match(userCard, /var\(--fx-text-strong\)/);
  assert.match(post, /min-h-11/);
  assert.match(post, /focus-visible:ring-2/);
});

