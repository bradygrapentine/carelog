---
name: grill
description: Adversarial review of current branch diff vs origin/main via a Sonnet subagent
---

Adversarial review of the current branch diff. Runs as a quality gate before opening
or merging a PR. Lighter-weight alternative to `codex-adversarial-gate` (and the
required substitute while Codex is disabled until 2026-05-16 — see global CLAUDE.md).

## Procedure

1. Verify base and capture diff scope:
   - `git fetch origin main`
   - `git log --oneline origin/main..HEAD` — confirm there are commits to review.
   - `git diff --stat origin/main...HEAD` — note files touched.
   - If diff is empty, stop and report "no changes to review".

2. Dispatch ONE subagent via the Task tool. Required parameters:
   - `subagent_type: "general-purpose"`
   - `model: "sonnet"` — NEVER opus (wrong cost profile for adversarial review).
   - Pre-grant Bash patterns in the prompt: `git diff`, `git log`, `git show`, `rg`, `grep`, `cat`.

3. Subagent brief (paste verbatim, then append the file list from step 1):

   > Act as adversarial reviewer over the diff between `origin/main` and `HEAD`.
   > Read the full diff with `git diff origin/main...HEAD`. Categorize every finding
   > as **must-fix**, **should-fix**, or **nit**. Cite `file:line` for each. Be terse.
   > No praise unless genuinely surprising. Focus areas for Carelog:
   > - PHI leaks: `posthog.identify()` / `posthog.capture()` MUST take anonymous UUID
   >   only — never email, name, phone, or any PII. Flag any violation as must-fix.
   > - RLS / auth: any new Supabase query or route handler that bypasses RLS or skips
   >   auth checks → must-fix.
   > - `BACKLOG.md` touched in a feature/fix PR → must-fix (BACKLOG-as-SoT rule).
   > - Raw hex / inline font-family in `apps/web/` → should-fix (use design tokens).
   > - Missing test coverage for new behavior, edge cases, race conditions, breaking
   >   API changes, perf regressions.
   > Output format: three sections (`## must-fix`, `## should-fix`, `## nit`), each
   > a bulleted list of `file:line — issue — suggested fix`. End with a one-line
   > verdict: SHIP IT / NEEDS WORK / BLOCK.

4. Relay the subagent's report verbatim. Do NOT auto-apply fixes — wait for
   explicit user approval before editing.

## Do NOT

- Use Opus for the subagent.
- Run a second adversarial pass without the user asking.
- Edit files during this command — it is read-only until the user authorizes fixes.
- Touch `BACKLOG.md`.
