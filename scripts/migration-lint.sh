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

  RISKY=""
  while IFS= read -r stmt; do
    [ -z "$stmt" ] && continue

    # Pattern 1: ADD COLUMN ... NOT NULL without DEFAULT (rewrites every row)
    if echo "$stmt" | grep -iqE "ADD[[:space:]]+COLUMN.*NOT[[:space:]]+NULL" && \
       ! echo "$stmt" | grep -iqE "[[:space:]]DEFAULT[[:space:]]"; then
      RISKY="${RISKY}  - ADD COLUMN ... NOT NULL without DEFAULT (rewrites every row, locks table)\n"
    fi

    # Pattern 2: CREATE INDEX without CONCURRENTLY (blocks writes during build)
    if echo "$stmt" | grep -iqE "CREATE[[:space:]]+(UNIQUE[[:space:]]+)?INDEX[[:space:]]" && \
       ! echo "$stmt" | grep -iqE "CONCURRENTLY"; then
      RISKY="${RISKY}  - CREATE INDEX without CONCURRENTLY (blocks writes during index build)\n"
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
