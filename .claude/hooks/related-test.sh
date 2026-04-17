#!/bin/bash
# PostToolUse hook for Edit|Write on apps/web .ts/.tsx source files.
# Finds the most-related test file and runs just that file (not the full suite).
# Surfaces failures immediately, keeping the red-green loop tight.
#
# Skips:
#   - test files themselves (don't recurse)
#   - declaration files (*.d.ts)
#   - files outside apps/web (server tests have a slower startup; let the commit hook catch them)
#
# Strategy for finding the related test file, in order:
#   1. Same dir: <dir>/__tests__/<basename>.test.tsx
#   2. Same dir: <dir>/<basename>.test.tsx
#   3. Parent dir: <parent>/__tests__/<basename>.test.tsx
# If none found, exit quietly — not every file has a test.

set -e

REPO_DIR="$(cd "$(dirname "$0")/../.." && pwd)"

payload=$(cat)

fp=$(echo "$payload" | python3 -c "import sys,json; print(json.load(sys.stdin).get('tool_input',{}).get('file_path',''))" 2>/dev/null || echo "")

# Quick exits
[ -z "$fp" ] && exit 0
case "$fp" in
  *__tests__*|*.test.ts|*.test.tsx|*.d.ts) exit 0 ;;
esac
case "$fp" in
  *apps/web/*) ;;
  *) exit 0 ;;
esac

# Extensions we handle
case "$fp" in
  *.ts|*.tsx) ;;
  *) exit 0 ;;
esac

dir=$(dirname "$fp")
base=$(basename "$fp")
stem="${base%.*}"

candidates=(
  "$dir/__tests__/$stem.test.tsx"
  "$dir/__tests__/$stem.test.ts"
  "$dir/$stem.test.tsx"
  "$dir/$stem.test.ts"
  "$(dirname "$dir")/__tests__/$stem.test.tsx"
)

test_file=""
for c in "${candidates[@]}"; do
  if [ -f "$c" ]; then
    test_file="$c"
    break
  fi
done

[ -z "$test_file" ] && exit 0

# Compute a relative path from apps/web so vitest can resolve it cleanly
rel="${test_file#$REPO_DIR/apps/web/}"

# Run with a hard 30s timeout — long tests should stay in the pre-commit hook
cd "$REPO_DIR/apps/web"
output=$( (timeout 30 npx vitest run --reporter=dot "$rel" 2>&1) || true)

# Only surface if there's a failure — the "passed" case is silent so we don't spam
if echo "$output" | grep -qE "(FAIL|failed|✗|×)"; then
  echo "[related-test] $rel"
  echo "$output" | tail -12
fi

exit 0
