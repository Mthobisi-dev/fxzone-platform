const { test } = require('node:test');
const assert = require('node:assert/strict');
async function loadPostMedia() {
  return import('./postMedia.ts');
}

test('allows a 90-second post video and rejects longer durations', async () => {
  const { MAX_POST_VIDEO_DURATION_SECONDS, isAllowedPostVideoDuration } = await loadPostMedia();

  assert.equal(MAX_POST_VIDEO_DURATION_SECONDS, 90);
  assert.equal(isAllowedPostVideoDuration(90), true);
  assert.equal(isAllowedPostVideoDuration(90.01), false);
});

test('rejects missing, zero, and non-finite post-video durations', async () => {
  const { isAllowedPostVideoDuration } = await loadPostMedia();

  assert.equal(isAllowedPostVideoDuration(0), false);
  assert.equal(isAllowedPostVideoDuration(Number.POSITIVE_INFINITY), false);
  assert.equal(isAllowedPostVideoDuration(Number.NaN), false);
});
