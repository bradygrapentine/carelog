#!/usr/bin/env bash
# scripts/ai-test.sh — headless Claude Code test generation
#
# Usage:
#   ./scripts/ai-test.sh unit apps/web/server/repositories/careEventsRepository.ts
#   ./scripts/ai-test.sh rls  care_events
#   ./scripts/ai-test.sh e2e  "invite flow"
#
#   ./scripts/ai-test.sh parallel unit \
#     apps/web/server/repositories \
#     apps/web/app/api/invite \
#     apps/web/server/routers

set -euo pipefail

SKILL=".claude/skills/test/SKILL.md"
TOOLS="Read,Write,Edit,Bash"

cmd="${1:-}"

if [[ -z "$cmd" ]]; then
  echo "Usage:"
  echo "  $0 unit     <file-or-dir>          Write Vitest unit tests"
  echo "  $0 rls      <table>                Write pgTAP RLS tests"
  echo "  $0 e2e      <flow-name>            Write Playwright e2e tests"
  echo "  $0 parallel <unit|rls|e2e> <t1> <t2> ...  Run multiple targets in parallel"
  exit 1
fi

# ── build_prompt ──────────────────────────────────────────────────────────────
# Returns the prompt string for a given type + target (no subprocess spawned).

build_prompt() {
  local type="$1"
  local target="$2"

  case "$type" in
    unit)
      cat <<PROMPT
Read the skill file at $SKILL and follow its rules throughout.

Write comprehensive Vitest unit tests for: $target

Steps:
1. Read docs/project-info/CLAUDE.md first
2. Read $target to understand what to test
3. Write tests covering: happy paths, edge cases, Zod validation failures, async error paths
4. Place tests in a __tests__ directory adjacent to the source file
5. Run: npx vitest run
6. Fix any failures iteratively until all tests pass
7. Report: how many tests written, what was covered
PROMPT
      ;;

    rls)
      cat <<PROMPT
Read the skill file at $SKILL and follow its rules throughout.

Write pgTAP RLS tests for the '$target' table. Add them to supabase/tests/rls_policies.test.sql.

Steps:
1. Read supabase/migrations/ to find all RLS policies for '$target'
2. Read supabase/tests/rls_policies.test.sql to understand the existing pattern
3. Add tests for: member can read own org's rows, cross-org rows return 0, coordinator-only mutations, unauthenticated returns 0
4. pgTAP rules:
   - Call fixture functions as postgres role (has bypassrls + INSERT on auth.users)
   - After CREATE TEMP TABLE: GRANT SELECT ON _fix TO PUBLIC
   - Switch users with: SET LOCAL ROLE authenticated; SET LOCAL "request.jwt.claims" TO '{"sub":"...","role":"authenticated"}'
   - Update plan() to match total test count
5. Run: supabase test db
6. Fix failures until all tests pass
PROMPT
      ;;

    e2e)
      cat <<PROMPT
Read the skill file at $SKILL and follow its rules throughout.

Write Playwright e2e tests for the '$target' flow. Add them to e2e/.

Steps:
1. Read these files completely before touching any code:
   - docs/project-info/CLAUDE.md
   - docs/project-info/ARCHITECTURE.md
   Summarize the '$target' flow in bullet points before proceeding.
2. Read e2e/helpers.ts to understand signIn(), clearMailpit(), and other utilities
3. Read an existing e2e test for structural patterns
4. Write tests covering: happy path, error states, edge cases
5. Playwright rules:
   - Prefer getByRole/getByText over CSS selectors; avoid strict-mode locator violations
   - Never submit a form with empty required fields (Zod rejects them)
   - Use signIn() from helpers.ts for auth setup
6. Run: pnpm exec playwright test e2e/<test-file>
7. Fix failures iteratively until all tests pass
PROMPT
      ;;

    *)
      echo "Unknown type: $type. Valid types: unit, rls, e2e" >&2
      exit 1
      ;;
  esac
}

# ── single ────────────────────────────────────────────────────────────────────

run_single() {
  local type="$1"
  local target="$2"
  claude -p "$(build_prompt "$type" "$target")" --allowedTools "$TOOLS"
}

# ── parallel ──────────────────────────────────────────────────────────────────

run_parallel() {
  local type="$1"
  shift
  local targets=("$@")

  if [[ ${#targets[@]} -eq 0 ]]; then
    echo "parallel requires at least one target" >&2
    exit 1
  fi

  local log_dir
  log_dir="$(mktemp -d)"
  local pids=()

  echo "Starting ${#targets[@]} parallel agents..."
  echo ""

  for target in "${targets[@]}"; do
    local log="$log_dir/$(echo "$target" | tr '/' '_').log"
    echo "  ▶ $target → $log"
    claude -p "$(build_prompt "$type" "$target")" --allowedTools "$TOOLS" > "$log" 2>&1 &
    pids+=($!)
  done

  echo ""
  echo "Waiting for all agents to finish..."
  echo ""

  local all_ok=true
  local i=0
  for pid in "${pids[@]}"; do
    local target="${targets[$i]}"
    local log="$log_dir/$(echo "$target" | tr '/' '_').log"

    if wait "$pid"; then
      echo "  ✓ $target"
    else
      echo "  ✗ $target (exit $?)"
      all_ok=false
    fi

    echo "── $target ──────────────────────────────────────"
    cat "$log"
    echo ""

    ((i++))
  done

  rm -rf "$log_dir"

  if [[ "$all_ok" == false ]]; then
    echo "One or more agents failed." >&2
    exit 1
  fi
}

# ── dispatch ──────────────────────────────────────────────────────────────────

case "$cmd" in
  unit|rls|e2e)
    target="${2:-}"
    if [[ -z "$target" ]]; then
      echo "Usage: $0 $cmd <target>" >&2
      exit 1
    fi
    run_single "$cmd" "$target"
    ;;

  parallel)
    type="${2:-}"
    if [[ -z "$type" ]]; then
      echo "Usage: $0 parallel <unit|rls|e2e> <target1> [target2 ...]" >&2
      exit 1
    fi
    shift 2
    run_parallel "$type" "$@"
    ;;

  *)
    echo "Unknown command: $cmd"
    echo "Valid commands: unit, rls, e2e, parallel"
    exit 1
    ;;
esac
