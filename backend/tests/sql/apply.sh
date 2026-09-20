#!/usr/bin/env bash
# Rebuilds a throw-away Postgres database with the stubbed Supabase pieces, the repo's
# schema and ALL migrations. Usage: tests/sql/apply.sh <database-url-without-db> <dbname>
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$HERE/../../.." && pwd)"
BASE="${1:-postgresql://postgres:postgres@localhost:5432}"
DB="${2:-fxzone_test}"
psql "$BASE/postgres" -q -v ON_ERROR_STOP=1 -c "DROP DATABASE IF EXISTS $DB WITH (FORCE)" -c "CREATE DATABASE $DB"
P="psql $BASE/$DB -q -v ON_ERROR_STOP=1"
$P -f "$HERE/00_supabase_stub.sql"
$P -f "$ROOT/supabase_schema.sql"
for f in "$ROOT"/supabase/migrations/00[1-6]_*.sql; do $P -f "$f"; done
$P -f "$HERE/99_grants.sql"
echo "database $DB ready"
