# ADR 0002: BACKLOG.md is the single source of truth for planned work

**Status:** Accepted
**Date:** 2026-05-10
**Deciders:** Brady Grapentine

## Context

Carelog tracks every planned feature, bug fix, tech-debt item, accessibility task, and polish story in a single root-level `BACKLOG.md`. Each row carries a lifecycle status (`Ready` / `In progress` / `In review` / `Blocked` / `Shipped`) and a typed prefix (`TD-*`, `A11Y-*`, `ON-*`, `PP-*`, `UX-*`).

In the 2026-04-25 session, the cost of letting feature PRs co-edit `BACKLOG.md` became unignorable: 5 of 7 PRs that day touched the file for legitimate-seeming reasons (status flips, follow-up TD rows discovered mid-feature, "while we're at it" cleanup). Rebasing those PRs against each other turned into roughly 90% of the session's wall-clock time. Two PRs editing adjacent rows in the same markdown table produce guaranteed conflicts on rebase, and the conflicts are mechanical-but-tedious — exactly the kind of overhead that drains a session without producing shippable work.

Story-status, in practice, is derivative information. Git log, the PR list, and the merge state already say which stories are in flight, in review, or shipped. Treating BACKLOG.md as authoritative for status forces every PR that ships a story to also touch the table — multiplying conflict surface for no real gain.

## Decision

`BACKLOG.md` is the single source of truth for **planned** work. Two operating rules follow:

1. **Feature / fix PRs do NOT touch `BACKLOG.md` at all.** No row updates, no status flips, no new follow-up TD rows in feature commits. A conventional-commit subject (e.g. `feat(td-24): …`) is enough for the `/backlog-sync` skill to reconstruct status from `git log` + the PR list.
2. **New TD / ON / A11Y / UX / PP rows go in dedicated `chore(backlog): …` PRs.** If follow-up work is discovered mid-feature, capture it as a TODO in the PR description and open a fresh BACKLOG-only PR after the feature merges (or let `/backlog-sync` pick it up at session end).

`/backlog-sync` is the only sanctioned writer for status flips and shipped-row promotion. It runs at session start and via `/session-end`, on its own branch, so backlog edits never collide with feature work.

## Consequences

**Positive:**

- Feature PRs no longer collide with each other on `BACKLOG.md` table rows. Rebase pain from parallel-dispatch waves drops to near zero.
- One canonical location for planned work — no parallel "TECH_DEBT.md" or "BUILD_STATUS.md" to drift out of sync.
- `/backlog-sync` owns all writes, so the file's structure stays consistent across sessions and agents.

**Negative / accepted trade-offs:**

- Story status in `BACKLOG.md` is derivative, not authoritative — there is a small lag between "PR merged" and "row promoted to §7 Shipped" (closed by the next `/backlog-sync` run). Accepted in exchange for clean rebases.
- Slight discoverability loss: someone reading `BACKLOG.md` mid-session may see a row marked `In progress` when the PR has actually merged. The PR list is the authoritative live view.
- Requires discipline: agents must resist the ergonomic urge to "just flip the status while I'm here." The rule is enforced in `CLAUDE.md` and surfaced to every dispatched subagent.

## Related

- `.claude/CLAUDE.md` § "READ FIRST — the backlog is the single source of truth" — the operative rule that this ADR codifies.
- `BACKLOG.md` — the file itself.
- `/backlog-sync` skill — the only sanctioned writer for status flips and shipped-row promotion.
