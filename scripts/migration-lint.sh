#!/usr/bin/env bash
# TD-136: lint migration SQL for risky DDL patterns that pass `db diff`
# cleanly but bite under production concurrent load. Statement-level
# scan — collapses multi-line DDL before regex match.
#
# NOT A SECURITY BOUNDARY. Belt-and-suspenders only. Known limitations:
#   - Semicolons inside string literals (e.g. DEFAULT 'a;b') fragment the
#     statement split. Vanishingly rare in DDL but possible — author-time
#     review (migration-safety skill) is the deeper check.
#   - Block comments /* ... */ are not stripped (only -- line comments).
#   - Dollar-quoted bodies ($func$ ... $func$) are not parsed.
# If your migration trips a false positive OR you need to bypass for any
# reason, add '-- safe-migration: <reason>' at the top of the file.
#
# Usage: migration-lint.sh <file1.sql> [file2.sql ...]
# Exit 0 = all clear; exit 1 = at least one risky pattern found.
set -euo pipefail

FILES=("$@")
EXIT=0

for f in "${FILES[@]}"; do
  [ -f "$f" ] || continue

  # Explicit opt-out: file-level safe-migration comment
  if grep -qE "^-- safe-migration: " "$f"; then
    echo "$f: PASS (explicit safe-migration justification)"
    continue
  fi

  # Normalize: strip line comments, then collapse each statement (separated by ;)
  # to one whitespace-normalized line. awk handles the comment-strip + join;
  # tr splits on semicolons; second awk trims and drops blank lines.
  STATEMENTS=$(awk '
    { sub(/--.*$/, ""); printf "%s ", $0 }
    END { print "" }
  ' "$f" | tr ';' '\n' | awk '{$1=$1; if (length) print}')

  # Pre-scan: collect names of tables CREATEd in THIS file. CREATE INDEX
  # statements targeting one of these are exempt from the CONCURRENTLY check
  # (zero rows at index time → zero write-blocking impact). Lowercased,
  # quotes stripped, schema prefix dropped — same normalization applied to
  # both the CREATE TABLE capture and the ON-target so they compare equal.
  # `|| true` on grep: empty match is normal (migration with no CREATE TABLE).
  # Without it, `set -e` aborts the whole script on a 1-exit from grep.
  LOCAL_TABLES=$( { echo "$STATEMENTS" \
    | grep -iE "^CREATE[[:space:]]+TABLE([[:space:]]+IF[[:space:]]+NOT[[:space:]]+EXISTS)?[[:space:]]" \
    || true; } \
    | sed -E 's/^[Cc][Rr][Ee][Aa][Tt][Ee][[:space:]]+[Tt][Aa][Bb][Ll][Ee]([[:space:]]+[Ii][Ff][[:space:]]+[Nn][Oo][Tt][[:space:]]+[Ee][Xx][Ii][Ss][Tt][Ss])?[[:space:]]+"?([a-zA-Z_][a-zA-Z0-9_]*\.)?"?([a-zA-Z_][a-zA-Z0-9_]*)"?.*/\3/' \
    | tr '[:upper:]' '[:lower:]')

  RISKY=""
  while IFS= read -r stmt; do
    [ -z "$stmt" ] && continue

    # Pattern 1: ADD COLUMN ... NOT NULL without DEFAULT (rewrites every row)
    if echo "$stmt" | grep -iqE "ADD[[:space:]]+COLUMN.*NOT[[:space:]]+NULL" && \
       ! echo "$stmt" | grep -iqE "[[:space:]]DEFAULT[[:space:]]"; then
      RISKY="${RISKY}  - ADD COLUMN ... NOT NULL without DEFAULT (rewrites every row, locks table)\n"
    fi

    # Pattern 2: CREATE INDEX without CONCURRENTLY (blocks writes during build).
    # Exempt: index targets a table created in this same file (zero rows at
    # index time). The outer `CREATE … INDEX` gate ensures `CREATE POLICY … ON x`
    # and `CREATE TRIGGER … ON x` are not misread as index targets.
    if echo "$stmt" | grep -iqE "CREATE[[:space:]]+(UNIQUE[[:space:]]+)?INDEX[[:space:]]" && \
       ! echo "$stmt" | grep -iqE "CONCURRENTLY"; then
      TARGET=$( { echo "$stmt" \
        | grep -ioE "[[:space:]]ON[[:space:]]+\"?([a-zA-Z_][a-zA-Z0-9_]*\.)?\"?[a-zA-Z_][a-zA-Z0-9_]*\"?[[:space:]]*\(" \
        || true; } \
        | sed -E 's/.*[[:space:]][Oo][Nn][[:space:]]+"?([a-zA-Z_][a-zA-Z0-9_]*\.)?"?([a-zA-Z_][a-zA-Z0-9_]*)"?[[:space:]]*\(.*/\2/' \
        | tr '[:upper:]' '[:lower:]')
      if [ -z "$TARGET" ] || ! echo "$LOCAL_TABLES" | grep -Fxq "$TARGET"; then
        RISKY="${RISKY}  - CREATE INDEX without CONCURRENTLY (blocks writes during index build)\n"
      fi
    fi

    # Pattern 3: DROP COLUMN (breaks deployed code still reading that column)
    if echo "$stmt" | grep -iqE "DROP[[:space:]]+COLUMN"; then
      RISKY="${RISKY}  - DROP COLUMN (must be coordinated with code rollout — remove column reads first)\n"
    fi
  done <<< "$STATEMENTS"

  if [ -n "$RISKY" ]; then
    EXIT=1
    echo "$f: FAIL"
    printf "%b" "$RISKY"
    echo "  Fix: address the issue OR add '-- safe-migration: <reason>' at the top of the file."
  else
    echo "$f: PASS"
  fi
done

exit $EXIT
