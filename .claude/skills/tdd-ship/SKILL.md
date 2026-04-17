---
name: tdd-ship
description: Strict test-driven delivery — write failing tests from the spec FIRST (commit red), implement minimum code until green (max 5 iterations), then refactor with tests still green. Escalates with a diagnostic if stuck instead of hacking around. Converts "mostly_achieved" into "fully_achieved" by construction.
user-invocable: true
---

# TDD Ship

Enforce red-green-refactor for any backlog story. Insights friction data showed 35 buggy-code and 34 wrong-approach events — this skill closes the loop by making tests the spec.

**Announce at start:** "Using /tdd-ship for <STORY-ID> — tests first, implementation until green, then refactor."

## When to use

- Story spec is clear enough to write AC as tests (most `🟢 Ready` rows qualify).
- Work fits in one PR.
- You want a single iteration at the end, not 4 correction rounds.

**Don't use for:**
- Exploratory / brainstorming work — unknowns can't be tested first.
- Pure refactors with no behavior change — covered by existing tests; just run them.
- UI-only polish where vitest can't express the check — rely on `chrome-devtools-mcp` instead.

## Arguments

`/tdd-ship <STORY-ID>` — e.g. `/tdd-ship ON-59`.

## The loop

### Stage 0 — Branch
```sh
git checkout -b feat/<story-id>-<slug>
```
Must not be on `main`. Hook will block commits there anyway.

### Stage 1 — RED (failing tests)

1. Read the BACKLOG row + any referenced spec in `docs/superpowers/specs/`.
2. Find the nearest existing test file to copy style (test setup, mock patterns, Tailwind/tRPC mocks).
3. Write a comprehensive failing test file covering every AC bullet. Use `describe` per AC.
4. **Run tests — they MUST fail for the right reason** (missing impl, not syntax error).
5. Commit: `test: failing tests for <STORY-ID>`.

**Red gate:** if tests pass without implementation, they're not testing the new behavior. Rewrite.

### Stage 2 — GREEN (iterate, budgeted)

Loop, max 5 iterations:
1. Edit implementation files.
2. Run the target test file: `cd apps/web && npx vitest run --reporter=dot <path>`.
3. If green → break.
4. If red → read the failure, make one targeted change, go to 1.

After each iteration, tsc-check: `cd apps/web && npx tsc --noEmit 2>&1 | grep "error TS" | grep <files-touched>`.

**Budget gate:** if 5 iterations pass without green, STOP. Write `docs/superpowers/plans/<story-id>-blocker.md` with:
- What the failing test expects.
- What 3-5 approaches were tried.
- Current working theory for why it's stuck.
- Escalate to the user.

Do not hack the test to make it pass. Do not add `it.skip`. Do not catch-and-ignore.

### Stage 3 — REFACTOR (tests stay green)

Once all target tests are green:
1. Full suite: `cd apps/web && npx vitest run --reporter=dot` — must stay green.
2. Look for: duplicated logic, magic numbers, unused vars, any / `as any`.
3. Apply one refactor → re-run full suite. If red → revert that refactor. Repeat.
4. Commit: `feat: <story-id> <story>`.

### Stage 4 — GATE BEFORE PUSH

- Full suite green (`cd apps/web && npx vitest run`).
- Typecheck clean on touched files.
- `git fetch origin main && git rebase origin/main` — conflicts resolved honestly.
- No `console.log`, no `.only`, no `.skip` added in this branch.
- PHI check if analytics files touched.

### Stage 5 — Push + PR
Same as `/ship-story` from Step 9 onward.

## Hard rules

- **Red before green, always.** Even for one-line fixes — write the failing regression test first.
- **Iteration budget is real.** 5 → escalate. Not 6, not "one more try". The friction data shows unbounded iteration produces buggy code.
- **Never edit the test to pass.** Only edit the test if the spec itself changed or the test was wrong.
- **Never catch-and-ignore.** If an error is unexpected, re-read the spec.
- **Refactor only after green.** Touching impl while tests are red blurs cause and effect.

## Integrations

- `/schema-dump` — if the feature touches the DB, run before Stage 1.
- `/review` — for PHI/RLS/auth stories, run after Stage 4 and before Stage 5.
- `superpowers:test-driven-development` — complementary guidance; this skill is the enforcement shell.
