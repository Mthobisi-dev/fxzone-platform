const { test } = require('node:test');
const assert = require('node:assert/strict');

test('initializes the theme before an auth subscription can fail', async () => {
  const { initializeClientBootstrap } = await import('./clientBootstrap.ts');
  const events = [];
  const cleanup = initializeClientBootstrap({
    initializeTheme: () => events.push('theme'),
    subscribeAuth: () => {
      events.push('auth');
      throw new Error('missing Supabase browser configuration');
    },
    onAuthError: () => events.push('handled'),
  });

  assert.deepEqual(events, ['theme', 'auth', 'handled']);
  assert.doesNotThrow(cleanup);
});
