const assert = require('node:assert/strict');
const { test } = require('node:test');

async function loadSystemAccounts() {
  return import('./systemAccounts.ts');
}

test('hides Jack Bot from public trader discovery regardless of username casing or whitespace', async () => {
  const { isHiddenSystemAccount } = await loadSystemAccounts();
  assert.equal(isHiddenSystemAccount('jackbot_analyst'), true);
  assert.equal(isHiddenSystemAccount('  JACKBOT_ANALYST '), true);
  assert.equal(isHiddenSystemAccount('real_trader'), false);
});
