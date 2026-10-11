const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');

const migrationPath = path.join(__dirname, '20261011191252_repair_live_session_realtime_authorization.sql');

test('live-session Realtime repair restores active-member access without public topics', () => {
  const migration = fs.readFileSync(migrationPath, 'utf8');
  const statements = migration.replace(/^--.*$/gm, '');

  assert.match(migration, /ALTER TABLE public\.session_participants ENABLE ROW LEVEL SECURITY/i);
  assert.match(migration, /CREATE POLICY fxzone_read_own_session_membership/i);
  assert.match(migration, /USING \(user_id = \(SELECT auth\.uid\(\)\)\)/i);
  assert.match(migration, /CREATE POLICY fxzone_realtime_private_read[\s\S]*ON realtime\.messages/i);
  assert.match(migration, /CREATE POLICY fxzone_realtime_private_write[\s\S]*ON realtime\.messages/i);
  assert.match(migration, /realtime\.topic\(\).*session_/i);
  assert.match(migration, /CREATE OR REPLACE FUNCTION public\.review_session_participant/i);
  assert.match(migration, /CREATE OR REPLACE FUNCTION public\.join_session/i);
  assert.doesNotMatch(statements, /ALTER TABLE realtime\.messages/i);
  assert.doesNotMatch(statements, /USING \(true\)/i);
});
