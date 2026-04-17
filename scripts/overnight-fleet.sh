#!/bin/bash
# Overnight autonomous backlog fleet with adversarial review gate
# Usage: ./scripts/overnight-fleet.sh [max-stories]              # arm for cron
#        ./scripts/overnight-fleet.sh --dry-run [max-stories]    # ceiling at 3 stories, no cron arming
# Output: reviews/overnight-YYYY-MM-DD.md
#
# What it does:
#   1. Snapshots the list of 🟢 Ready rows in BACKLOG.md at start.
#   2. Invokes Claude Code headless against /backlog-dispatch with a
#      max-story cap (default 6) and an explicit instruction to dispatch
#      only Sonnet workers (no Haiku — prior sessions hit context limits).
#   3. For each PR opened, runs adversarial review gates (read-only):
#        - /review  — PHI/RLS/auth security pass
#        - /test-gaps — missing-coverage analysis
#      Findings are appended to the morning report. Gates do NOT auto-fail
#      the run — human reviews the findings before merging.
#   4. Writes a morning summary: attempted, opened, blocked, review findings.
#   5. Exits non-zero if fewer than 1 PR opened (signal the cron failed).
#
# Safety:
#   - Does nothing if another instance is running (flock on .git/overnight.lock).
#   - Refuses to start if the working tree is dirty — clean main only.
#   - NEVER auto-merges. Human reviews the adversarial findings.
#   - The PreToolUse main-commit hook still applies to every subagent.
#
# Dry run: --dry-run caps --max-stories at 3, skips the cron-readiness check,
#   and writes to reviews/overnight-dryrun-YYYY-MM-DD.md. Use to validate before
#   arming the cron.
#
# Cron (after ≥2 clean dry runs):
#   0 2 * * * cd /Users/bradygrapentine/projects/carelog && ./scripts/overnight-fleet.sh 6 >> reviews/overnight.log 2>&1

set -euo pipefail

DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$DIR"

DRY_RUN=0
if [ "${1:-}" = "--dry-run" ]; then
  DRY_RUN=1
  shift
fi

MAX_STORIES="${1:-6}"
if [ "$DRY_RUN" = "1" ] && [ "$MAX_STORIES" -gt 3 ]; then
  MAX_STORIES=3
fi

DATE=$(date +%Y-%m-%d)
OUTDIR="$DIR/reviews"
if [ "$DRY_RUN" = "1" ]; then
  OUTFILE="$OUTDIR/overnight-dryrun-$DATE.md"
else
  OUTFILE="$OUTDIR/overnight-$DATE.md"
fi
LOCK="$DIR/.git/overnight.lock"

mkdir -p "$OUTDIR"

# ── Preflight ─────────────────────────────────────────────
if [ -n "$(git status --porcelain)" ]; then
  echo "[overnight-fleet] aborting — working tree is dirty"
  exit 1
fi

current_branch=$(git branch --show-current)
if [ "$current_branch" != "main" ]; then
  echo "[overnight-fleet] aborting — current branch is $current_branch, expected main"
  exit 1
fi

# Refuse to run two instances at once
exec 200>"$LOCK"
if ! flock -n 200; then
  echo "[overnight-fleet] another instance is already running (lock: $LOCK)"
  exit 1
fi

git fetch origin main --quiet
git merge --ff-only origin/main

# ── Snapshot the Ready set BEFORE dispatch ─────────────────
echo "## Overnight fleet — $DATE" > "$OUTFILE"
echo "" >> "$OUTFILE"
echo "### Ready snapshot at $(date +%H:%M)" >> "$OUTFILE"
echo "" >> "$OUTFILE"
grep -E "^\|\s*(ON|TD|PP|UX|A11Y)-\S+\s*\|\s*🟢 Ready" BACKLOG.md \
  | awk -F'|' '{printf "- %s — %s\n", $2, $6}' >> "$OUTFILE" || true
echo "" >> "$OUTFILE"

# ── Dispatch ───────────────────────────────────────────────
echo "### Dispatch output" >> "$OUTFILE"
echo "" >> "$OUTFILE"
echo '```' >> "$OUTFILE"

set +e
claude -p "Run /backlog-dispatch against the current 🟢 Ready rows in BACKLOG.md. Hard rules: (1) cap the fleet at $MAX_STORIES stories — pick the smallest/safest first; (2) every subagent MUST use the Sonnet model via the Task tool — NEVER Haiku (context limits); (3) every worktree MUST have node_modules symlinked from the main repo before the subagent runs; (4) every subagent prompt MUST include the full FILES ALLOWED / BRANCH / DO NOT / PHI RULE scope contract from CLAUDE.md; (5) after each story PR opens, flip BACKLOG.md row to 🔎 In review in a separate commit; (6) never merge — leave PRs open for human review; (7) if any subagent is BLOCKED after 2 retries, mark the BACKLOG row 🔴 Blocked with the reason and move on. Output a single consolidated markdown report at the end with per-story status (PR opened / blocked / failed) and a follow-up table." \
  --allowedTools "Read,Glob,Grep,Bash,Edit,Write,Agent" \
  --output-format text >> "$OUTFILE" 2>&1
dispatch_exit=$?
set -e

echo '```' >> "$OUTFILE"
echo "" >> "$OUTFILE"

# ── Post-run reconciliation ────────────────────────────────
echo "### PRs opened in this run" >> "$OUTFILE"
echo "" >> "$OUTFILE"

# Capture PR numbers we'll review below
prs_from_run=$(gh pr list --state open --author "@me" --limit 20 \
  --json number,title,headRefName,createdAt \
  --jq '.[] | select(.createdAt > (now - 10 * 60 * 60 | todate)) | .number' 2>/dev/null || true)

if [ -n "$prs_from_run" ]; then
  for pr_num in $prs_from_run; do
    pr_info=$(gh pr view "$pr_num" --json number,title,headRefName --jq '"- [#\(.number)](https://github.com/bradygrapentine/carelog/pull/\(.number)) \(.title) — `\(.headRefName)`"' 2>/dev/null || echo "- #$pr_num")
    echo "$pr_info" >> "$OUTFILE"
  done
else
  echo "(no PRs opened in this run window)" >> "$OUTFILE"
fi
echo "" >> "$OUTFILE"

echo "### Blocked rows added this run" >> "$OUTFILE"
echo "" >> "$OUTFILE"
git diff HEAD~3..HEAD BACKLOG.md 2>/dev/null | grep "^+.*🔴 Blocked" | head -10 >> "$OUTFILE" || true
echo "" >> "$OUTFILE"

# ── Adversarial review gate (READ-ONLY — never auto-merges) ─
if [ -n "$prs_from_run" ]; then
  echo "### Adversarial review findings" >> "$OUTFILE"
  echo "" >> "$OUTFILE"
  echo "Read-only passes per PR. These do NOT block merge — human reviews." >> "$OUTFILE"
  echo "" >> "$OUTFILE"

  for pr_num in $prs_from_run; do
    head_ref=$(gh pr view "$pr_num" --json headRefName --jq '.headRefName' 2>/dev/null || echo "")
    [ -z "$head_ref" ] && continue

    echo "#### PR #$pr_num (\`$head_ref\`)" >> "$OUTFILE"
    echo '```' >> "$OUTFILE"
    set +e
    claude -p "Run /review on PR #$pr_num (branch: $head_ref). Diff against origin/main. Severity-ranked findings only — Critical / Medium / Low / None. Include file:line. Do NOT edit any files." \
      --allowedTools "Read,Glob,Grep,Bash" \
      --output-format text >> "$OUTFILE" 2>&1
    claude -p "Run /test-gaps analysis on the diff in PR #$pr_num (branch: $head_ref). List untested paths with file:line — be terse. Do NOT edit any files." \
      --allowedTools "Read,Glob,Grep,Bash" \
      --output-format text >> "$OUTFILE" 2>&1
    set -e
    echo '```' >> "$OUTFILE"
    echo "" >> "$OUTFILE"
  done
fi

# ── Count outcomes ─────────────────────────────────────────
prs_count=$(gh pr list --state open --author "@me" --limit 20 \
  --json createdAt --jq '[.[] | select(.createdAt > (now - 10 * 60 * 60 | todate))] | length' 2>/dev/null || echo "0")

echo "[overnight-fleet] run complete — $prs_count PRs opened — report: $OUTFILE"
if [ "$DRY_RUN" = "1" ]; then
  echo "[overnight-fleet] DRY-RUN mode — cron not armed. Review the report, run again if you want one more dry pass before arming."
fi

if [ "$prs_count" -lt 1 ] || [ $dispatch_exit -ne 0 ]; then
  echo "[overnight-fleet] FAIL — exit $dispatch_exit, PRs $prs_count"
  exit 2
fi

exit 0
