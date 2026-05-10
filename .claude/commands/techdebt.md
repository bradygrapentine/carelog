---
name: techdebt
description: End-of-session dead-code and TODO/FIXME/HACK scan — read-only punch-list
---

End-of-session tech-debt sweep. Surfaces TODO/FIXME/HACK markers and likely
dead exports across the repo. Produces a punch-list for the user to review.

**This command is READ-ONLY.** It does NOT modify `BACKLOG.md` — per the
project rule, new TD rows must land in dedicated `chore(backlog): …` PRs,
never bundled with feature work. Surface findings here; the user decides what
to graduate to a backlog row.

## Procedure

1. Marker scan — collect annotated comments. Restrict to source dirs to avoid
   noise from `node_modules`, `.next`, `dist`, `coverage`, lockfiles:
   ```sh
   rg -n --no-heading -g '!**/node_modules/**' -g '!**/.next/**' \
     -g '!**/dist/**' -g '!**/coverage/**' -g '!**/*.lock' \
     -e 'TODO' -e 'FIXME' -e 'HACK' -e 'XXX' \
     apps/ packages/ supabase/ e2e/
   ```

2. Dead-export sweep for the web app. For each file under `apps/web/lib/`,
   `apps/web/components/`, `apps/web/hooks/`:
   - Extract exported symbols: `rg -n '^export (const|function|type|class) (\w+)' <file>`
   - For each symbol, check usage elsewhere: `rg -l "\b<symbol>\b" apps/ packages/ | grep -v <file>`
   - Symbols with zero external usage are candidates. Flag, do not delete.
   - Skip route files (`app/**/page.tsx`, `app/**/layout.tsx`, `app/**/route.ts`)
     and barrel `index.ts` re-exports — Next.js consumes those by convention.

3. Optional: stale plan / spec docs under `docs/plans/` whose corresponding
   backlog rows are in §7 Shipped. List them; do not delete.

4. Format the report as three sections:
   ```
   ## TODO / FIXME / HACK markers
   - <file>:<line> — <marker> — <one-line context>

   ## Likely dead exports
   - <file>:<line> — <symbol> — no external references found

   ## Possibly stale plan docs
   - <path> — corresponding backlog row Shipped on <date>
   ```

5. End with a one-line summary: total markers, dead-export candidates,
   stale plans. Suggest the user open a `chore(backlog):` PR if any items
   warrant a TD-* row.

## Do NOT

- Modify `BACKLOG.md` — new TD rows belong in a dedicated backlog PR.
- Delete dead-export candidates automatically — false positives from dynamic
  imports / route conventions / test fixtures are common. User confirms.
- Edit any source file. This command is a punch-list, not a fixer.
- Add the markers to PR descriptions or commit messages.
