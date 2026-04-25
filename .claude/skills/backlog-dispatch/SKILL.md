---
name: backlog-dispatch
description: Alias for `/dispatch --from-backlog`. Kept for muscle memory. The canonical dispatcher is `/dispatch`, which now picks the right execution mode based on input — backlog-driven (this alias) or ad-hoc list. Mirrors the /wave shape of "one skill, picks the right mode."
user-invocable: true
---

# Backlog Dispatch (alias)

This skill is a thin alias. The canonical dispatcher is **`/dispatch`** (one skill, two input modes — ad-hoc task list OR `BACKLOG.md` §1 Ready rows).

## What this alias does

When invoked, behave exactly as if the user had run:

```
/dispatch --from-backlog [args...]
```

Then follow the `/dispatch` skill's process verbatim. The backlog-mode branch of `/dispatch` already handles:

- Reading `BACKLOG.md` §1 `Status: 🟢 Ready` rows
- Skipping rows blocked by un-shipped items
- Flagging rows missing acceptance criteria as "needs spec"
- Asking the user to subset when >5 rows are Ready
- TDD discipline per item (delegated to `/tdd-ship`)
- Auto-merge by default, except for PHI-touching diffs (Opus review first)
- `/backlog-sync` after the run to reconcile §0

## Why this exists

Before consolidation, `/backlog-dispatch` and `/dispatch` were two separate skills with ~30% duplicated boilerplate (scope contract, pre-flight, worktree setup). They were merged into `/dispatch` with mode-selection — same shape as `/wave` (which picks the right execution mode per wave plan).

The alias is preserved so existing muscle memory and references in CLAUDE.md still work. New work should reach for `/dispatch` directly.

## See also

- `/dispatch` — the canonical dispatcher (start here)
- `worktree-subagents` — primitive that owns pre-flight, worktree-with-symlinks, and the scope-contract template
- `/tdd-ship` — per-item TDD discipline used in backlog mode
- `/backlog-sync` — runs after backlog-mode dispatches
