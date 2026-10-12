const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');

const migrationPath = path.join(__dirname, '20261011191252_repair_live_session_realtime_authorization.sql');
const followerAdmissionPath = path.join(__dirname, '20261012110000_enforce_live_session_follower_approval.sql');

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

test('legacy counter triggers use a fixed SECURITY DEFINER search path', () => {
  const hardeningPath = path.join(__dirname, '20261012010000_harden_legacy_counter_triggers.sql');
  assert.ok(fs.existsSync(hardeningPath), 'the counter-trigger hardening migration must exist');
  const migration = fs.readFileSync(hardeningPath, 'utf8');

  assert.match(migration, /ALTER FUNCTION public\.handle_follow\(\)\s+SET search_path = pg_catalog, public, pg_temp/i);
  assert.match(migration, /ALTER FUNCTION public\.handle_post_like\(\)\s+SET search_path = pg_catalog, public, pg_temp/i);
  assert.doesNotMatch(migration, /DROP FUNCTION|DROP TABLE|TRUNCATE|DELETE\s+FROM/i);
});

test('live-session admission requires a follow and host approval before private Realtime access', () => {
  assert.ok(fs.existsSync(followerAdmissionPath), 'the follower-only admission migration must exist');
  const migration = fs.readFileSync(followerAdmissionPath, 'utf8');
  const statements = migration.replace(/^--.*$/gm, '');

  assert.match(migration, /CREATE OR REPLACE FUNCTION public\.join_session/i);
  assert.match(migration, /FROM public\.follows AS follow_relation/i);
  assert.match(migration, /follow_relation\.follower_id = p_user_id/i);
  assert.match(migration, /follow_relation\.following_id = v_session\.host_id/i);
  assert.match(migration, /Follow the host before requesting access/i);
  assert.match(migration, /v_role := 'pending'/i);
  assert.match(migration, /CREATE OR REPLACE FUNCTION public\.review_session_participant/i);
  assert.match(migration, /Participant no longer follows the host/i);
  assert.match(migration, /SET search_path = pg_catalog, public, pg_temp/i);
  assert.doesNotMatch(statements, /DROP TABLE|TRUNCATE|DELETE\s+FROM/i);
});
