---
name: ship-story
description: Ship a single backlog story end-to-end — read the row, create a feature branch, implement with tests, push, open a PR, and flip the status to 🔎 In review in the same commit. Scoped to one story; use /backlog-dispatch for multi-story parallel runs.
user-invocable: true
---

# Ship Story

Take one `🟢 Ready` row from `BACKLOG.md` and drive it to PR.

**Announce at start:** "Using /ship-story to ship `<STORY-ID>`."

## When to use

- Single story, ready right now, you want it in review by end of session.
- Story is small enough for one PR (≤8 files, well-scoped).

**Don't use for:**
- Batch/overnight work → use `/backlog-dispatch`.
- Unscoped or still-brainstorming ideas → use `superpowers:brainstorming` first.

## Arguments

`/ship-story <STORY-ID>` — e.g. `/ship-story ON-51`.

If no ID given, list the current `🟢 Ready` rows and ask the user which.

## Process

### 1. Read the row
```sh
grep -E "^\| $STORY_ID " BACKLOG.md
```
Capture the Story, Notes, and Size. If blocked or not Ready, stop and report.

### 2. Pre-flight
- `git branch --show-current` → must be `main` (or offer to switch).
- `git fetch origin main && git status` → clean tree.
- Check `node_modules` symlinks if working in a worktree.

### 3. Create the branch
```sh
git checkout -b feat/$(echo $STORY_ID | tr '[:upper:]' '[:lower:]')-<short-slug>
```

### 4. Flip status to ⚡ In progress in the SAME first commit
Edit BACKLOG.md row: `🟢 Ready` → `⚡ In progress`, set `Owner:` and `Branch:`.
Commit so stalls are visible to other sessions / `/backlog-sync`.

### 5. Tests first
Read the relevant nearest existing test to get the test pattern. Write failing tests for the story's AC. Run — confirm they fail. Commit `test: failing <story> tests`.

### 6. Implement until green
Iterate: edit → `cd apps/web && npx vitest run --reporter=dot` → fix. Max 5 loops. If stuck, escalate — don't hack. Include typecheck: `cd apps/web && npx tsc --noEmit`.

### 7. Pre-push gate
- `cd apps/web && npx vitest run` — full suite green.
- `cd apps/web && npx tsc --noEmit` — no new errors in touched files.
- `git fetch origin main && git rebase origin/main` — resolve conflicts honestly (not `--skip`).

### 8. Update BACKLOG.md
Flip row to `🔎 In review`, set `PR: #NNN` (fill after push). Commit in the same push.

### 9. Push + PR
```sh
git push -u origin HEAD
gh pr create --base main --title "feat: <STORY-ID> <story>" --body "..."
```
Body must include:
- **Summary** — what changed
- **Test plan** — what to click / what CI covers
- **PHI note** if analytics files touched: "UUID only, no PII/PHI"

### 10. Return
Print the PR URL, the story ID, and the final test count delta (before → after).

## Rules

- One commit per logical step: status flip, failing tests, implementation, final status flip. Squash-merge at the end.
- Never commit to `main` directly — the `PreToolUse` hook blocks it anyway.
- Never skip the failing-test step — "I'll add tests later" produces the `buggy-code` friction the insights caught.
- If the story turns out to be larger than one PR mid-flight, stop and split: leave this one scoped, file a follow-up `ON-*` row for the rest.
- If the implementation exposes schema questions, invoke `/schema-dump` **before** writing SQL — don't guess at column names.

## Integrations

- `/schema-dump` — when touching migrations or seed data.
- `/review` — optional adversarial pass before `gh pr create` (required for PHI/RLS/auth).
- `/backlog-sync` — runs automatically on `/session-end`; manual invocation not needed after ship-story.
