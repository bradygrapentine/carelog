#!/usr/bin/env bash
# TD-145 — dev-gate test harness for scripts/migration-lint.sh.
# Not wired into CI; CI invokes the production script directly via
# .github/workflows/migration-lint.yml. Run locally before touching the lint.
#
# Usage: bash scripts/__tests__/migration-lint.test.sh
# Exit 0 = all cases pass; exit 1 = at least one assertion failed.

set -uo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
LINT="$REPO_ROOT/scripts/migration-lint.sh"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

PASS=0
FAIL=0

run_case() {
  local name="$1"
  local file="$2"
  local want_exit="$3"
  local want_grep="$4" # optional grep -E pattern in output; empty = no check

  local out
  out="$(bash "$LINT" "$file" 2>&1)"
  local got_exit=$?

  if [ "$got_exit" -ne "$want_exit" ]; then
    echo "✗ $name — exit $got_exit, want $want_exit"
    echo "  output: $out"
    FAIL=$((FAIL + 1))
    return
  fi

  if [ -n "$want_grep" ] && ! echo "$out" | grep -qE "$want_grep"; then
    echo "✗ $name — output missing /$want_grep/"
    echo "  output: $out"
    FAIL=$((FAIL + 1))
    return
  fi

  echo "✓ $name"
  PASS=$((PASS + 1))
}

# (a) Index on existing table without CONCURRENTLY → FAIL (regression check
#     for the original Pattern 2 behavior — must keep flagging).
cat > "$TMP/a.sql" <<'SQL'
CREATE INDEX foo_idx ON existing_table(bar);
SQL
run_case "(a) existing-table non-concurrent index → FAIL" "$TMP/a.sql" 1 \
  "CREATE INDEX without CONCURRENTLY"

# (b) New table + non-concurrent index on it → PASS (the whitelist).
cat > "$TMP/b.sql" <<'SQL'
CREATE TABLE foo (id uuid PRIMARY KEY);
CREATE INDEX foo_idx ON foo(id);
SQL
run_case "(b) new-table + non-concurrent index on it → PASS" "$TMP/b.sql" 0 \
  "$TMP/a.sql|PASS"

# (c) New table + CONCURRENTLY index → PASS.
cat > "$TMP/c.sql" <<'SQL'
CREATE TABLE foo (id uuid PRIMARY KEY);
CREATE INDEX CONCURRENTLY foo_idx ON foo(id);
SQL
run_case "(c) new-table + concurrent index → PASS" "$TMP/c.sql" 0 "PASS"

# (d) safe-migration bypass — existing behavior, regression check.
cat > "$TMP/d.sql" <<'SQL'
-- safe-migration: tested separately in case d
CREATE INDEX foo_idx ON existing_table(bar);
SQL
run_case "(d) safe-migration bypass → PASS" "$TMP/d.sql" 0 \
  "explicit safe-migration"

# (e) Mixed — new table + index on it (allowed) + index on OTHER existing table (flagged).
cat > "$TMP/e.sql" <<'SQL'
CREATE TABLE new_thing (id uuid PRIMARY KEY);
CREATE INDEX new_thing_idx ON new_thing(id);
CREATE INDEX other_idx ON old_thing(bar);
SQL
run_case "(e) mixed — new-table index allowed, existing-table index flagged → FAIL" \
  "$TMP/e.sql" 1 "CREATE INDEX without CONCURRENTLY"

# (e') Quoted-identifier path — exercise the regex's quote-stripping.
cat > "$TMP/e2.sql" <<'SQL'
CREATE TABLE "Quoted_Tbl" (id uuid PRIMARY KEY);
CREATE INDEX qt_idx ON "Quoted_Tbl"(id);
SQL
run_case "(e') quoted CREATE TABLE + quoted ON ref → PASS" "$TMP/e2.sql" 0 "PASS"

# (f) Schema-qualified — exercise the schema-prefix-stripping in both captures.
cat > "$TMP/f.sql" <<'SQL'
CREATE TABLE public.schema_qualified (id uuid PRIMARY KEY);
CREATE INDEX sq_idx ON public.schema_qualified(id);
SQL
run_case "(f) schema-qualified CREATE TABLE + schema-qualified ON ref → PASS" \
  "$TMP/f.sql" 0 "PASS"

# Real-migration spot-checks (sanity: prod-script behavior on shipped files).
run_case "(real) SEC-007 ocr_audit_log → PASS (no false positive)" \
  "$REPO_ROOT/supabase/migrations/20260516010000_create_ocr_audit_log.sql" 0 "PASS"

run_case "(real) shifts_schema_align → FAIL (legitimate flag retained)" \
  "$REPO_ROOT/supabase/migrations/20260408000001_shifts_schema_align.sql" 1 \
  "CREATE INDEX without CONCURRENTLY"

echo
echo "Result: $PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ]
