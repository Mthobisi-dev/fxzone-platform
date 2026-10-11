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

test('broadcast schema compatibility migration restores the approval column', () => {
  const compatibilityPath = path.join(__dirname, '20261011205854_restore_live_session_approval_schema.sql');
  assert.ok(fs.existsSync(compatibilityPath), 'the production schema repair migration must exist');
  const migration = fs.readFileSync(compatibilityPath, 'utf8');
  const statements = migration.replace(/^--.*$/gm, '');

  assert.match(migration, /ALTER TABLE public\.live_sessions\s+ADD COLUMN IF NOT EXISTS requires_approval BOOLEAN/i);
  assert.match(migration, /ALTER COLUMN requires_approval SET DEFAULT true/i);
  assert.match(migration, /SET requires_approval = true\s+WHERE requires_approval IS NULL/i);
  assert.match(migration, /ALTER COLUMN requires_approval SET NOT NULL/i);
  assert.doesNotMatch(statements, /DROP TABLE|TRUNCATE|DELETE\s+FROM/i);
});
