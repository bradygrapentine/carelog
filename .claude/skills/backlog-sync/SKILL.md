---
name: backlog-sync
description: Reconcile BACKLOG.md against git log, open PRs, and shipped code. Rewrites the §0 status-board counts, promotes merged stories to §7, flags stale "In progress" rows, and surfaces newly discovered work. Run at session start, session end, and on a daily cron.
user-invocable: true
---

# Backlog Sync

Keep `BACKLOG.md` as the single source of truth. This skill does reconciliation — it does **not** invent new stories or reword existing ones.

## When to run

- **Session start** on this repo — flip any stories already merged to §7 before planning
- **Session end** via `/session-end`
- **Daily cron** via `/schedule` — e.g. `/schedule backlog-sync "0 6 * * *"` (6 am local)
- Any time the §0 status board counts look stale

## Steps

### 1. Snapshot current state
```bash
git fetch origin main --quiet
git log --oneline origin/main..HEAD
git log --oneline -30 origin/main
gh pr list --state open --json number,title,headRefName,isDraft 2>/dev/null || echo "gh unavailable"
```

### 2. Reconcile rows

Read `BACKLOG.md`. For each non-shipped story:

1. **If merged** — move the row to §7 (shipped log) with a compact one-line summary. Remove from §1–§5.
2. **If a PR is open for its branch** — flip `Status:` to `🔎 In review`, set `PR: #NNN`.
3. **If `Status: ⚡ In progress` but no branch/PR exists and no commit touching relevant files in last 7 days** — flag as STALE in the report; do **not** silently revert to Ready (the owner may be paused).
4. **If `Blocked by:` points at an ID now in §7** — flip to 🟢 Ready, clear the blocker.

### 3. Surface new work

Grep for newly introduced markers since the last sync:

```bash
git diff origin/main...HEAD -- '*.ts' '*.tsx' '*.sql' | grep -nE '^\+.*\b(TODO|FIXME|XXX|HACK)\b' || true
```

For each match, check BACKLOG.md — if there's no matching row, list it in the report as a candidate new story (do NOT auto-add; user or planning agent decides prefix + priority).

### 4. Rewrite §0 status board

Recount rows by `Status:` field across §1–§6. Update the §0 table in place. Update the "Last `/backlog-sync`:" date at the top.

### 5. Report

Emit a compact report:

```
Backlog sync — YYYY-MM-DD
  Promoted to §7 (shipped): ID, ID, ID
  Flipped to In review:     ID → PR #NNN
  Stale In-progress:        ID (last touched N days ago)
  Unblocked:                ID
  New TODO/FIXME candidates:
    - path/to/file.ts:LINE  text
  §0 board updated: Ready=N, InProgress=N, InReview=N, Blocked=N
```

## Rules

- **Do not invent stories.** Only reconcile what exists in git against BACKLOG.md.
- **Do not delete.** Every story ends up in §7 (shipped) or 🧊 (deferred with reason).
- **Do not edit code.** This is a documentation reconciliation skill only.
- If a reconcile is ambiguous (e.g. commit message mentions two IDs), list it in the report and ask — don't guess.
- Commit the BACKLOG.md update on whatever the current branch is with message `chore(backlog): sync YYYY-MM-DD` unless the branch is `main` (then ask first).
