# Plan-With-Tests Skill — Design Spec

**Date:** 2026-04-09
**Status:** Approved for implementation

## Problem

When handing off a plan from Claude Code to Continue.dev, agents interpret ambiguous step descriptions and make reasonable-but-wrong choices about what "done" means. The agent runs with its interpretation and only the mismatch is discovered after several steps of implementation.

## Solution

A skill that forces test-first plan generation. Every plan step is only "done" when specific, pre-written failing tests pass. The agent can't hallucinate done — it either passes the tests or it doesn't.

## Workflow

```
1. Read spec or task description
2. For each deliverable, write the minimal failing tests capturing necessary flows
   - Happy path
   - Key error cases
   - Auth/security boundaries relevant to the step
   → Use the `test` skill for patterns
   → Tests MUST fail before proceeding — run pnpm test to confirm
3. Group tests by implementation step (one step = one cohesive change)
4. For each step, produce a JSON block with: description, files, verify, do_not
5. Output the complete JSON plan
6. State: "Run pnpm test to confirm all tests are currently failing"
```

**Hard rules:**
- No step without a `verify` field — if a deliverable can't be tested, decompose it differently or write a smoke test
- Tests are committed before the plan is handed off — Continue.dev starts with a failing suite
- `do_not` is required on every step — forces explicit scope at authoring time, not implementation time

## Plan Format

```json
{
  "task": "human-readable description of the full deliverable",
  "steps": [
    {
      "description": "what to implement — specific, not vague",
      "files": ["exact/path/to/file.tsx"],
      "verify": {
        "command": "pnpm test FileName",
        "passes_when": [
          "exact test name string 1",
          "exact test name string 2",
          "exact test name string 3"
        ]
      },
      "do_not": ["explicit scope boundary 1", "explicit scope boundary 2"]
    }
  ]
}
```

`passes_when` strings must exactly match test names as they appear in the Vitest output. All strings must pass — partial pass is not done.

For RLS/pgTAP steps, use `supabase test db` as the command and the pgTAP test description as `passes_when`.

## Harness Changes

**New file:** `.claude/skills/plan-with-tests/SKILL.md`

**Updated:** `.claude/CLAUDE.md` — plan format block updated to show `verify` field. Note that `writing-plans` (superpowers) is still used for non-Continue.dev plans (architecture docs, multi-session work). This skill is specifically for Continue.dev handoff plans.

## Continue.dev Handoff Prompt Template

The plan is pasted into Continue.dev chat with this wrapper so the agent knows to use the verify field:

```
Implement this plan step by step. After each step, run the verify command
and confirm every string in passes_when appears in the output before proceeding.
Do not move to the next step until all verify strings pass.
Respect the do_not constraints exactly.

[paste JSON plan here]
```

## What Does Not Change

- The `test` skill — invoked as a sub-step to write the tests
- The `writing-plans` skill — still used for non-handoff plans
- Continue.dev config — no tooling changes required; the agent reads the plan from chat and runs `pnpm test` manually or via terminal context
