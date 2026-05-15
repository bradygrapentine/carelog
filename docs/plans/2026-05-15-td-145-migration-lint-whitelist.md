# TD-145 — migration-lint: whitelist CREATE INDEX on same-migration new tables

**Date:** 2026-05-15
**Base SHA:** a5fe37f
**Source backlog:** TD-145
**PRD:** n/a
**Recommended executor:** direct single-track (~30min)

## Goal

`scripts/migration-lint.sh` flags every `CREATE INDEX` lacking `CONCURRENTLY` as risky — correct for indexes on existing tables (block writes during build) but a false positive when the index targets a table created in the same migration (zero rows → zero impact). SEC-007 (PR #531) tripped this advisory post-merge despite indexing a brand-new empty table.

Update the lint script to recognize `CREATE TABLE <name>` earlier in the same file and skip the CONCURRENTLY check for `CREATE INDEX … ON <name>` statements that target one of those locally-created tables. Add a bash test harness covering the new logic and existing rules.

## Non-goals

- Don't touch the SEC-007 migration retroactively — already merged; the lint script is the right fix-forward target (prevents future false positives, not just this one).
- Don't broaden whitelist beyond same-file new tables. Indexes on existing tables still need `CONCURRENTLY`.
- Don't add YAML/JSON config, env vars, or external tooling. Pure bash, stay tiny.

## Tracks

### Track 1 — migration-lint whitelist + tests

**Sources backlog TD-145.**

**FILES ALLOWED** (modify/create):
- `scripts/migration-lint.sh` (modify)
- `scripts/__tests__/migration-lint.test.sh` (create — bash test harness)

**FILES OUT OF SCOPE — DO NOT TOUCH:**
- `.github/workflows/migration-lint.yml` — CI calls `bash scripts/migration-lint.sh ${{ steps.changed.outputs.files }}` (verified at `.github/workflows/migration-lint.yml:28`). The script's contract — args, exit codes, per-file PASS/FAIL output line — is preserved. The new `migration-lint.test.sh` is a **developer gate only**, not wired into CI; CI continues to invoke the production script directly. If we want CI to run the test harness later, that's a separate row (out of scope here)
- `supabase/migrations/*` — already-shipped migrations stay as-is
- `apps/web/**` — unrelated

**Branch:** `chore/td-145-migration-lint-whitelist` off base SHA above.

**Implementation steps:**

1. In `scripts/migration-lint.sh`, AFTER the existing awk-collapse at lines 34–37 produces `$STATEMENTS` (one statement per line, whitespace-normalized — this is the SAME input the per-statement loop reads), pre-scan `$STATEMENTS` once to build a `LOCAL_TABLES` set. Use POSIX ERE: `^CREATE[[:space:]]+TABLE([[:space:]]+IF[[:space:]]+NOT[[:space:]]+EXISTS)?[[:space:]]+"?([a-zA-Z_][a-zA-Z0-9_]*\.)?"?([a-zA-Z_][a-zA-Z0-9_]*)"?` — capture group 3 is the bare table name (group 2 absorbs an optional `schema.` prefix; both single-quoted and double-quoted identifiers fold to bare by stripping quotes after capture). Store lowercased names in a newline-separated `LOCAL_TABLES` string; membership test via `grep -Fxq` against the string.

   The ocr_audit_log migration's CREATE TABLE spans lines 7–19 in the raw file with embedded `CHECK ( confirmed_field_keys <@ ARRAY[...] )` clauses (parens inside the column list). The existing awk-collapse at `scripts/migration-lint.sh:34-37` joins all lines + splits on `;`, producing one statement that begins `CREATE TABLE ocr_audit_log ( id uuid PRIMARY KEY ... )`. The regex above captures `ocr_audit_log` from that collapsed form. Verify by running the regex against the actual `$STATEMENTS` output for the SEC-007 migration before adding the test harness.

2. Inside the per-statement loop, for statements already matched as `CREATE … INDEX` at `scripts/migration-lint.sh:50` (do NOT loosen the gate — only operate on confirmed CREATE INDEX statements; this avoids false matches on `CREATE POLICY … ON <table>` or `CREATE TRIGGER … ON <table>` which collapse into the same `$STATEMENTS` stream), extract the target table with POSIX ERE: `[[:space:]]ON[[:space:]]+"?([a-zA-Z_][a-zA-Z0-9_]*\.)?"?([a-zA-Z_][a-zA-Z0-9_]*)"?[[:space:]]*\(` — capture group 2 is the bare table name. The regex tolerates no-space-before-paren (SEC-007 line 44–45: `ON ocr_audit_log(ocr_job_id)` with no space — `[[:space:]]*\(` matches both `(` and ` (`).

   Lowercase the extracted name, then `grep -Fxq` against `LOCAL_TABLES`. On hit, **silently skip** the CONCURRENTLY check for this statement (do not append to `$RISKY`). Per N2: the script's contract is one PASS/FAIL line per file, not per statement — do NOT add per-statement output. The other risky patterns (ADD COLUMN NOT NULL no DEFAULT, DROP COLUMN) still run unchanged.

3. Other patterns (ADD COLUMN NOT NULL without DEFAULT, DROP COLUMN) unchanged.

**Portability constraint (S2):** stick to `grep -iE` / `grep -oE` / `grep -Fxq` only. **Do NOT use `grep -P`** (BSD grep on macOS lacks PCRE). Avoid `\b` word boundaries (BSD unreliable). All regex stays POSIX ERE.
4. Author `scripts/__tests__/migration-lint.test.sh`:
   - Uses `mktemp -d` for fixture dir; cleans up on exit via `trap`.
   - 5 fixture cases:
     a. `existing-table-no-concurrent.sql`: only `CREATE INDEX foo ON existing(bar);` → expect FAIL, exit 1
     b. `new-table-with-index.sql`: `CREATE TABLE foo (...); CREATE INDEX foo_idx ON foo(bar);` → expect PASS, exit 0 (the new whitelist)
     c. `new-table-concurrent-index.sql`: `CREATE TABLE foo (...); CREATE INDEX CONCURRENTLY foo_idx ON foo(bar);` → expect PASS, exit 0
     d. `safe-migration-bypass.sql`: top comment `-- safe-migration: tested separately` + risky index → expect PASS, exit 0
     e. `mixed.sql`: one CREATE TABLE + one index on it (allowed) + one index on `other_existing_table` (flagged) → expect FAIL, exit 1, message references the second index only
   - Uses `assert_pass` / `assert_fail` shell helpers; prints colored ✓/✗ markers; exits nonzero if any case fails.
5. Run the test script locally: `bash scripts/__tests__/migration-lint.test.sh` → all green.
6. Confirm the SEC-007 migration (already shipped, still on disk) now passes: `bash scripts/migration-lint.sh supabase/migrations/20260516010000_create_ocr_audit_log.sql` → `PASS`.

**Acceptance (verifiable):**

- `bash scripts/__tests__/migration-lint.test.sh` exits 0 with all 5 cases ✓
- `bash scripts/migration-lint.sh supabase/migrations/20260516010000_create_ocr_audit_log.sql` exits 0 (PASS), with the prior FAIL output gone
- `bash scripts/migration-lint.sh supabase/migrations/20260408000001_shifts_schema_align.sql` still flags its non-CONCURRENT index on the pre-existing `shifts` table (regression check — pinned per S1; this migration adds indexes to a table created in an earlier migration, so the whitelist must NOT apply)
- Existing `-- safe-migration:` opt-out comment still bypasses everything (case d)
- `bash -n scripts/migration-lint.sh` parses clean

**Risk + mitigations:**

- **Risk:** identifier extraction misses edge cases (schema-qualified names like `public.foo`, quoted identifiers like `"foo"`, `IF NOT EXISTS`). **Mitigation:** test fixture (a) covers existing-table flag; mixed fixture (e) covers index-on-other-existing-table; normalize identifiers via a single helper (lowercase, strip quotes, drop schema prefix) applied to BOTH the CREATE TABLE capture AND the ON-target extraction so they compare equal.
- **Risk:** awk/sed regex bash-portability across macOS BSD vs Linux GNU. **Mitigation:** stick to `grep -iE` and POSIX awk constructs already in use; avoid `\b` word boundaries (BSD grep lacks `\b` reliably). Test runs on macOS dev box AND CI ubuntu-latest — CI is the authoritative check.

## Merge order

Single track; ships as one PR.

## Execution gate

Run `/opus-on-opus docs/plans/2026-05-15-td-145-migration-lint-whitelist.md --from-sprint` before commit. Apply must-fix findings.

## Post-merge verification

- CI's "Lint risky DDL patterns" check on the next migration PR that creates a new table + index should pass without `-- safe-migration:`.
- No need for `/post-deploy-watch` — script change, no prod surface.

## Open questions

None.
