const { test } = require('node:test');
const assert = require('node:assert/strict');
test('People excludes self, strangers and one-way follows', async () => {
  const { mutualConnectionIds } = await import('./mutualConnections.ts');
  assert.deepEqual(mutualConnectionIds('me', [{following_id:'me'}, {following_id:'friend'}, {following_id:'outgoing'}], [{follower_id:'me'}, {follower_id:'friend'}, {follower_id:'incoming'}]), ['friend']);
  assert.deepEqual(mutualConnectionIds('me', [], [{follower_id:'incoming'}]), []);
});
