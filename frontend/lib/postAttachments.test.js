const { test } = require('node:test');
const assert = require('node:assert/strict');

test('mixed attachment posts retain order and remove only media marker lines', async () => {
  const { readPostAttachments } = await import('./postAttachments.ts');
  assert.deepEqual(readPostAttachments('My update\n\n📎 https://example.com/b.mp4\n📎 https://example.com/c.png', 'https://example.com/a.jpg'), {
    urls: ['https://example.com/a.jpg', 'https://example.com/b.mp4', 'https://example.com/c.png'], text: 'My update',
  });
});
test('normal links and unrecognized attachments remain visible', async () => {
  const { readPostAttachments } = await import('./postAttachments.ts');
  const text = 'https://example.com/news\n📎 https://example.com/article';
  assert.deepEqual(readPostAttachments(text), { text, urls: [] });
});
test('media-only posts and duplicates preserve a single gallery item', async () => {
  const { readPostAttachments } = await import('./postAttachments.ts');
  assert.deepEqual(readPostAttachments('📊 Shared media attachment\n📎 https://example.com/a.jpg', 'https://example.com/a.jpg'), { text: '', urls: ['https://example.com/a.jpg'] });
});
