const assert = require('node:assert/strict');
const { test } = require('node:test');

test('story audience includes the owner and mutual follows only', async () => {
  const { storyAudienceIds } = await import('./storyAudience.ts');

  assert.deepEqual(
    storyAudienceIds(
      'viewer',
      [{ following_id: 'mutual' }, { following_id: 'outgoing-only' }],
      [{ follower_id: 'mutual' }, { follower_id: 'incoming-only' }],
    ),
    ['viewer', 'mutual'],
  );
});

test('story audience is still limited to the owner when no follows are mutual', async () => {
  const { storyAudienceIds } = await import('./storyAudience.ts');

  assert.deepEqual(storyAudienceIds('viewer', [], []), ['viewer']);
});
