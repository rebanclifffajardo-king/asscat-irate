#!/bin/bash
# Runs the migration + RLS/feature test suites against a THROWAWAY PostgreSQL
# database (no Docker required). NEVER point this at a real project.
#
#   DATABASE_ADMIN_URL=postgresql://postgres@127.0.0.1:5432/postgres ./supabase/tests/run.sh
#
# The stub file recreates the minimal Supabase pieces (auth.users, auth.uid(),
# storage schema, anon/authenticated/service_role roles) that migrations need.
set -euo pipefail
cd "$(dirname "$0")/../.."
ADMIN_URL="${DATABASE_ADMIN_URL:-postgresql://postgres@127.0.0.1:5432/postgres}"
DB="irate_test_$$"
P="psql -v ON_ERROR_STOP=1 -q"
$P "$ADMIN_URL" -c "create database $DB"
trap '$P "$ADMIN_URL" -c "drop database if exists $DB" >/dev/null' EXIT
URL="${ADMIN_URL%/*}/$DB"
$P "$URL" -f supabase/tests/00_local_supabase_stub.sql
for f in supabase/migrations/*.sql; do $P "$URL" -f "$f"; done
$P "$URL" -f supabase/seed.sql >/dev/null
out=$( { psql "$URL" -f supabase/tests/10_rls_tests.sql; psql "$URL" -f supabase/tests/20_feature_tests.sql; } 2>&1 | sed 's/^psql:[^ ]* NOTICE:  //' | grep -E "^(PASS|FAIL)" )
echo "$out"
echo "----"
echo "$(grep -c '^PASS' <<<"$out") passed, $(grep -c '^FAIL' <<<"$out" || true) failed"
! grep -q '^FAIL' <<<"$out"
