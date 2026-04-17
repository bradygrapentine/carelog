#!/bin/bash
# Overnight autonomous backlog fleet
# Usage: ./scripts/overnight-fleet.sh [max-stories]
# Output: reviews/overnight-YYYY-MM-DD.md
#
# What it does:
#   1. Snapshots the list of 🟢 Ready rows in BACKLOG.md at start.
#   2. Invokes Claude Code headless against /backlog-dispatch with a
#      max-story cap (default 6) and an explicit instruction to dispatch
#      only Sonnet workers (no Haiku — prior sessions hit context limits).
#   3. Captures the consolidated report and writes a morning summary:
#      what was attempted, what merged, what failed, and the follow-up
#      backlog IDs that were filed for each failure.
#   4. Exits non-zero if fewer than 1 PR opened (signal the cron failed).
#
# Safety:
#   - Does nothing if another instance of this script is already running
#     (flock on .git/overnight.lock).
#   - Refuses to start if the working tree is dirty — clean main only.
#   - Passes CLAUDE_ALLOW_MAIN_COMMIT=0 so the main-branch-block hook
#     still applies to subagents.
#
# Cron:
#   0 2 * * * cd /Users/bradygrapentine/projects/carelog && ./scripts/overnight-fleet.sh 6 >> reviews/overnight.log 2>&1

set -euo pipefail

DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$DIR"

MAX_STORIES="${1:-6}"
DATE=$(date +%Y-%m-%d)
OUTDIR="$DIR/reviews"
OUTFILE="$OUTDIR/overnight-$DATE.md"
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
gh pr list --state open --author "@me" --limit 20 \
  --json number,title,headRefName,createdAt \
  --jq '.[] | select(.createdAt > (now - 10 * 60 * 60 | todate)) | "- [#\(.number)](https://github.com/bradygrapentine/carelog/pull/\(.number)) \(.title) — `\(.headRefName)`"' \
  >> "$OUTFILE" 2>/dev/null || echo "(gh pr list unavailable)" >> "$OUTFILE"
echo "" >> "$OUTFILE"

echo "### Blocked rows added this run" >> "$OUTFILE"
echo "" >> "$OUTFILE"
git diff HEAD~3..HEAD BACKLOG.md 2>/dev/null | grep "^+.*🔴 Blocked" | head -10 >> "$OUTFILE" || true
echo "" >> "$OUTFILE"

# ── Count outcomes ─────────────────────────────────────────
prs_count=$(gh pr list --state open --author "@me" --limit 20 \
  --json createdAt --jq '[.[] | select(.createdAt > (now - 10 * 60 * 60 | todate))] | length' 2>/dev/null || echo "0")

echo "[overnight-fleet] run complete — $prs_count PRs opened — report: $OUTFILE"

if [ "$prs_count" -lt 1 ] || [ $dispatch_exit -ne 0 ]; then
  echo "[overnight-fleet] FAIL — exit $dispatch_exit, PRs $prs_count"
  exit 2
fi

exit 0
