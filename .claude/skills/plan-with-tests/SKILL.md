---
name: plan-with-tests
description: Use when writing a test-first handoff plan for any subordinate agent (local Ollama model via /ollama, or a subagent via the Task tool). Generates plans where each step has a verify field with runnable tests that define "done".
---

# Plan-With-Tests

Use this skill instead of `writing-plans` when the output is a handoff plan for a subordinate agent (`/ollama` dispatch, Task-tool subagent, or headless script).

## Process (RIGID — follow exactly)

1. Read the spec or task description
2. For each deliverable, write the minimal failing tests that capture the necessary flows:
   - Happy path
   - Key error cases
   - Auth/security boundaries relevant to the step
   → Invoke the `test` skill: "Write minimal failing tests for these flows: [list flows]"
   → Run `pnpm test` to confirm tests are **FAILING** before proceeding — do not continue if tests pass prematurely
3. Group tests by implementation step (one cohesive change per step)
4. For each step, produce a JSON block with `description`, `files`, `verify`, and `do_not`
5. Output the complete JSON plan
6. State: "Run `pnpm test` to confirm ALL verify tests are currently failing before handing off to the executing agent"

## Hard Rules

- No step without a `verify` field — if a deliverable can't be tested, decompose it differently or write a smoke test
- Tests must be **committed** before handoff — the executing agent starts with a red suite
- `do_not` is required on every step — explicit scope at authoring time, not implementation time
- `passes_when` strings must exactly match test names as they appear in Vitest output. Example: if Vitest prints "✓ handles 404 errors", use "handles 404 errors" (without the ✓)

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

For RLS/pgTAP steps: use `supabase test db` as the command. The `passes_when` string is the `ok()` description as it appears in `supabase test db` output. Example: "test_rls_can_invite_org_members".

## Handoff Prompt

Wrap the JSON plan in this template when dispatching to the executing agent (`/ollama`, Task-tool subagent, or headless script):

```
Implement this plan step by step. After each step, run the verify command
and confirm every string in passes_when appears in the output before proceeding.
Do not move to the next step until all verify strings pass.
Respect the do_not constraints exactly.

[paste JSON plan here]
```
