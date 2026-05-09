#!/usr/bin/env bash
# Pre-commit vitest gate. Runs `vitest run --related <staged-files>` so the
# pre-commit suite is scoped to tests that actually depend on what's staged.
#
# Why related-only:
# - The full vitest config has 3 projects, including a chromium-backed
#   browser project that races on vi.mock factory hoisting + Vite optimizeDeps
#   (see apps/web/vitest.config.ts:55-60). When the staged change doesn't
#   touch any browser-project tests, there's no reason to spin up that
#   project at all.
# - Bails on first failure so flakes surface fast.
# - Filters output to last 5 lines per CLAUDE.md "Pre-commit hook" doc.
#
# Reads stdin (Claude Code hook JSON), inspects the planned command,
# and only acts on `git commit`.

set -uo pipefail

cmd=$(python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('tool_input',{}).get('command',''))" 2>/dev/null)

if ! echo "$cmd" | grep -qE '(^|[[:space:]&;|])git[[:space:]]+commit([[:space:]]|$)'; then
  exit 0
fi

staged=$(git diff --cached --name-only --diff-filter=ACM \
  | grep -E '\.(ts|tsx|js|jsx|mjs|cjs)$' \
  | grep '^apps/web/' \
  | sed 's|^apps/web/||')

if [ -z "$staged" ]; then
  exit 0
fi

MAIN_ROOT=$(python3 -c "
import subprocess
r = subprocess.run(['git', 'rev-parse', '--absolute-git-dir'], capture_output=True, text=True)
s = r.stdout.strip()
print(s.split('/.git')[0] if '/.git' in s else s)
")

cd "$MAIN_ROOT/apps/web" || exit 0

# Word-split $staged on newlines/spaces (intentional — vitest related accepts multiple paths).
# Vitest 4.x moved --related to a `related` subcommand and dropped the flag form.
# shellcheck disable=SC2086
output=$(npx vitest related $staged --run --reporter=dot --bail=1 2>&1)
ec=$?

echo "$output" | tail -5

if [ $ec -ne 0 ]; then
  echo '[blocked] Pre-commit test failures - fix tests before committing' >&2
  exit 2
fi

# D.3 — catch lint errors locally before CI Lint flags them. Particularly
# the React 19 react-hooks/purity rule (Date.now() / Math.random() inside
# useMemo / useCallback) — vitest doesn't catch this but CI Lint does, so
# it currently surfaces post-push with a 5+ minute round-trip.
# Scope: same staged files vitest just ran against. --quiet means warnings
# don't block (preserves the TD-14 downgrades to warn for no-explicit-any
# etc.); only errors block.
# shellcheck disable=SC2086
lint_output=$(npx eslint --quiet --no-error-on-unmatched-pattern $staged 2>&1)
lint_ec=$?

if [ $lint_ec -ne 0 ]; then
  echo "$lint_output" | tail -15
  echo '[blocked] Pre-commit lint errors - fix before committing' >&2
  exit 2
fi

exit 0
