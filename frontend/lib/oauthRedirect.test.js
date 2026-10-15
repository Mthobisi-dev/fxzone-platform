const { test } = require('node:test');
const assert = require('node:assert/strict');

async function loadOAuthRedirect() {
  return import('./oauthRedirect.ts');
}

test('keeps the Google OAuth callback on the browser origin that owns the PKCE verifier', async () => {
  const { buildOAuthRedirectUrl } = await loadOAuthRedirect();

  assert.equal(
    buildOAuthRedirectUrl('https://preview-fxzone.vercel.app', 'https://fxzone.example/', '/dashboard'),
    'https://preview-fxzone.vercel.app/auth/callback?next=%2Fdashboard'
  );
});

test('uses the current browser origin when no canonical site is configured', async () => {
  const { buildOAuthRedirectUrl } = await loadOAuthRedirect();

  assert.equal(
    buildOAuthRedirectUrl('https://fxzone-platform.vercel.app', undefined, '/dashboard'),
    'https://fxzone-platform.vercel.app/auth/callback?next=%2Fdashboard'
  );
});

test('falls back to the configured site when a browser origin is unavailable', async () => {
  const { buildOAuthRedirectUrl } = await loadOAuthRedirect();

  assert.equal(
    buildOAuthRedirectUrl('', 'https://fxzone.example/', '/dashboard'),
    'https://fxzone.example/auth/callback?next=%2Fdashboard'
  );
});

test('rejects external OAuth destinations', async () => {
  const { safeOAuthDestination } = await loadOAuthRedirect();

  assert.equal(safeOAuthDestination('/profile/me'), '/profile/me');
  assert.equal(safeOAuthDestination('//attacker.example'), '/dashboard');
  assert.equal(safeOAuthDestination('https://attacker.example'), '/dashboard');
});
