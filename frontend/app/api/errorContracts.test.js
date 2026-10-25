const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROUTES = [
  'social/users/route.ts',
  'social/users/[id]/follow/route.ts',
  'social/users/[id]/route.ts',
  'sessions/route.ts',
  'sessions/[id]/route.ts',
  'sessions/[id]/participants/route.ts',
  'sessions/[id]/leave/route.ts',
  'sessions/[id]/end/route.ts',
  'notifications/[id]/read/route.ts',
  'notifications/read-all/route.ts',
  'chat/conversations/route.ts',
  'chat/conversations/[id]/messages/route.ts',
  'chat/conversations/[id]/media-upload-url/route.ts',
  'chat/conversations/[id]/media-url/route.ts',
  'social/posts/upload/route.ts',
  'social/posts/upload-url/route.ts',
  'webrtc/credentials/route.ts',
];

test('sensitive API routes do not expose raw provider or database errors', () => {
  for (const relativePath of ROUTES) {
    const source = fs.readFileSync(path.join(__dirname, relativePath), 'utf8');
    assert.doesNotMatch(source, /detail:\s*error\?\.message/,
      `${relativePath} exposes error.message`);
    assert.doesNotMatch(source, /detail:\s*authErr\b/,
      `${relativePath} exposes authErr`);
    assert.doesNotMatch(source, /detail:\s*leaveError\.message/,
      `${relativePath} exposes leaveError.message`);
  }
});
