const { test } = require('node:test');
const assert = require('node:assert/strict');

async function loadPostUpload() {
  return import('./postUpload.ts');
}

test('routes files over the Vercel request-body limit to a direct signed upload', async () => {
  const { DIRECT_POST_UPLOAD_THRESHOLD_BYTES, shouldUseDirectPostUpload } = await loadPostUpload();

  assert.equal(shouldUseDirectPostUpload(DIRECT_POST_UPLOAD_THRESHOLD_BYTES), false);
  assert.equal(shouldUseDirectPostUpload(DIRECT_POST_UPLOAD_THRESHOLD_BYTES + 1), true);
});

test('uses media-specific post attachment limits', async () => {
  const { getPostMediaSizeLimit, isAllowedPostMedia } = await loadPostUpload();

  assert.equal(getPostMediaSizeLimit('image/jpeg'), 10 * 1024 * 1024);
  assert.equal(getPostMediaSizeLimit('application/pdf'), 20 * 1024 * 1024);
  assert.equal(getPostMediaSizeLimit('audio/webm'), 25 * 1024 * 1024);
  assert.equal(getPostMediaSizeLimit('video/mp4'), 100 * 1024 * 1024);
  assert.equal(isAllowedPostMedia('video/mp4', 100 * 1024 * 1024), true);
  assert.equal(isAllowedPostMedia('video/mp4', 100 * 1024 * 1024 + 1), false);
  assert.equal(isAllowedPostMedia('text/plain', 10), false);
});
