const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('Google OAuth and normal browser auth use one cookie-backed Supabase client', () => {
  const normalClient = fs.readFileSync(path.join(__dirname, 'supabase.ts'), 'utf8');
  const callback = fs.readFileSync(path.join(__dirname, '..', 'app', '(auth)', 'auth', 'callback', 'page.tsx'), 'utf8');

  assert.match(normalClient, /getSupabaseBrowserClient/);
  assert.doesNotMatch(normalClient, /createClient\(/);
  assert.doesNotMatch(callback, /supabase\.auth\.setSession/);
});
