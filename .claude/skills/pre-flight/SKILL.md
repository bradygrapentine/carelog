# Pre-flight audit

**READ-ONLY. Do NOT edit any files.**

Before a multi-task session, verify which items are already complete so planning targets real gaps — not redundant work.

## Process

1. Identify the plan or backlog document being executed (e.g. `docs/superpowers/plans/*.md`, `OVERNIGHT_BACKLOG.md`, `docs/project-info/product/BACKLOG_PHASE*.md`). If the user has not named one, ask once, then stop.
2. For each item in the plan:
   - Check the doc itself for `✅ DONE`, `SHIPPED`, or strike-through markers.
   - `git log --oneline -40` — scan for commit messages matching the item id or description.
   - Grep the repo for the named files, routes, tables, functions, or schemas the task is supposed to create. Absence of any of them is a strong signal that the item is not done.
   - For E2E items, check `e2e/` for a matching spec file.
   - For migrations, check `supabase/migrations/` for a matching timestamp or name.
3. Produce a single table and stop. Format:

```
| ID | Title | Status | Evidence |
|----|-------|--------|----------|
| ON-01 | ... | done | commit abc123 + backlog strike-through |
| ON-05 | ... | partial | shifts.spec.ts exists, coverage-settings.spec.ts missing |
| ON-10 | ... | todo | no migration, no router change |
```

Status is one of `done`, `partial`, `todo`, `blocked`.

4. Do not start implementing anything. Wait for the user to pick the first item after seeing the table.

## Rules

- Do not assume a task is done because a similar-sounding file exists — verify the actual scope (migration name, component name, test count).
- Do not assume a task is undone because the file exists but is empty — read it.
- Keep the table under 30 rows. If the plan is bigger, split into multiple runs.
- Never invoke Edit or Write during this skill. If you need a scratch list, keep it in the response itself.
