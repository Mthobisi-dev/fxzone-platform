const { test } = require('node:test');
const assert = require('node:assert/strict');

async function loadGesture() {
  try {
    return await import('./postGesture.ts');
  } catch {
    return {};
  }
}

test('a nearby second tap within the time window likes the post', async () => {
  const { registerPostTap } = await loadGesture();
  assert.equal(typeof registerPostTap, 'function');
  const first = registerPostTap(null, { at: 1_000, x: 40, y: 80 });
  const second = registerPostTap(first.nextTap, { at: 1_260, x: 46, y: 84 });
  assert.equal(first.isDoubleTap, false);
  assert.equal(second.isDoubleTap, true);
  assert.equal(second.nextTap, null);
});

test('a slow or distant second tap starts a new tap sequence', async () => {
  const { registerPostTap } = await loadGesture();
  assert.equal(typeof registerPostTap, 'function');
  assert.equal(registerPostTap({ at: 1_000, x: 10, y: 10 }, { at: 1_500, x: 10, y: 10 }).isDoubleTap, false);
  assert.equal(registerPostTap({ at: 1_000, x: 10, y: 10 }, { at: 1_200, x: 80, y: 10 }).isDoubleTap, false);
});

test('a swipe is not treated as a tap', async () => {
  const { isPostTap } = await loadGesture();
  assert.equal(typeof isPostTap, 'function');
  assert.equal(isPostTap({ x: 10, y: 10 }, { x: 18, y: 15 }), true);
  assert.equal(isPostTap({ x: 10, y: 10 }, { x: 70, y: 10 }), false);
});

test('gallery indicators match attachment count and active item', async () => {
  const { galleryIndicators } = await loadGesture();
  assert.equal(typeof galleryIndicators, 'function');
  assert.deepEqual(galleryIndicators(4, 2), [false, false, true, false]);
  assert.deepEqual(galleryIndicators(1, 0), [true]);
  assert.deepEqual(galleryIndicators(0, 0), []);
});

test('double tap can only like and never removes an existing like', async () => {
  const { nextPostLikeState } = await loadGesture();
  assert.equal(typeof nextPostLikeState, 'function');
  assert.equal(nextPostLikeState(false, true), true);
  assert.equal(nextPostLikeState(true, true), true);
  assert.equal(nextPostLikeState(false, false), true);
  assert.equal(nextPostLikeState(true, false), false);
});
