#!/usr/bin/env bash
# Local-dev only: builds a Postgres that looks enough like Supabase for the FxZone schema + migrations.
# (Real deployments use Supabase: run supabase/migrations/006_backend_hardening.sql there instead.)
set -euo pipefail
P="psql -v ON_ERROR_STOP=1 -U $POSTGRES_USER -d $POSTGRES_DB -q"
$P -f /repo/backend/tests/sql/00_supabase_stub.sql
$P -f /repo/supabase_schema.sql
for f in /repo/supabase/migrations/00[1-6]_*.sql; do $P -f "$f"; done
$P -f /repo/backend/tests/sql/99_grants.sql
