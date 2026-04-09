# Plan-With-Tests Skill Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create a `plan-with-tests` skill and update the CLAUDE.md plan format so Continue.dev handoff plans always include runnable verify tests that define "done" for each step.

**Architecture:** Two file changes — a new skill file that enforces test-first plan generation, and an updated plan format block in CLAUDE.md that adds `verify` and `do_not` fields. The skill is rigid (follow exactly). The CLAUDE.md change updates the example format and adds the handoff prompt template.

**Tech Stack:** Markdown skill files, `.claude/CLAUDE.md` config

---

### Task 1: Update CLAUDE.md plan format

**Files:**
- Modify: `.claude/CLAUDE.md` (Token Discipline section — Structured plan format block)

- [ ] **Step 1: Verify current format block**

Read `.claude/CLAUDE.md` and locate the "Structured plan format for Continue.dev handoff" section. It currently reads:

```json
{"task": "description", "files": ["path/to/file.ts"], "steps": ["Step 1: ...", "Step 2: ..."], "constraints": ["keep Zod schema in sync"]}
```

- [ ] **Step 2: Replace the plan format block**

Replace the entire `**Structured plan format for Continue.dev handoff:**` block with:

```
**Structured plan format for Continue.dev handoff:**
\```json
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
          "exact test name string 2"
        ]
      },
      "do_not": ["explicit scope boundary 1", "explicit scope boundary 2"]
    }
  ]
}
\```

`passes_when` strings must exactly match test names as they appear in Vitest output. All must pass.
For pgTAP steps: use `supabase test db` as the command.

**Continue.dev handoff prompt:**
\```
Implement this plan step by step. After each step, run the verify command
and confirm every string in passes_when appears in the output before proceeding.
Do not move to the next step until all verify strings pass.
Respect the do_not constraints exactly.

[paste JSON plan here]
\```
```

- [ ] **Step 3: Verify the edit looks correct**

Read `.claude/CLAUDE.md` Token Discipline section. Confirm:
- `verify` field present with `command` and `passes_when` array
- `do_not` field present
- Handoff prompt template present
- No leftover old format

- [ ] **Step 4: Commit**

```bash
git add .claude/CLAUDE.md
git commit -m "feat: update plan format with verify and do_not fields"
```

---

### Task 2: Create the plan-with-tests skill

**Files:**
- Create: `.claude/skills/plan-with-tests/SKILL.md`

- [ ] **Step 1: Create the skill file**

Create `.claude/skills/plan-with-tests/SKILL.md` with this exact content:

```markdown
---
name: plan-with-tests
description: Use when writing a Continue.dev handoff plan. Generates test-first plans where each step has a verify field with runnable tests that define "done". Use instead of writing-plans for Continue.dev handoffs.
---

# Plan-With-Tests

Use this skill instead of `writing-plans` when the output is a Continue.dev handoff plan.

## Process (RIGID — follow exactly)

1. Read the spec or task description
2. For each deliverable, write the minimal failing tests that capture the necessary flows:
   - Happy path
   - Key error cases
   - Auth/security boundaries relevant to the step
   → Invoke the `test` skill for pgTAP and Vitest patterns
   → Run `pnpm test` to confirm tests are **FAILING** before proceeding — do not continue if tests pass prematurely
3. Group tests by implementation step (one cohesive change per step)
4. For each step, produce a JSON block with `description`, `files`, `verify`, and `do_not`
5. Output the complete JSON plan
6. State: "Run `pnpm test` to confirm all verify tests are currently failing before handing off to Continue.dev"

## Hard Rules

- No step without a `verify` field — if a deliverable can't be tested, decompose it differently or write a smoke test
- Tests must be **committed** before handoff — Continue.dev starts with a red suite
- `do_not` is required on every step — explicit scope at authoring time, not implementation time
- `passes_when` strings must exactly match test names as they appear in Vitest output

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

For RLS/pgTAP steps: use `supabase test db` as the command and the pgTAP test description as `passes_when` strings.

## Continue.dev Handoff Prompt

Wrap the JSON plan in this template when pasting into Continue.dev:

```
Implement this plan step by step. After each step, run the verify command
and confirm every string in passes_when appears in the output before proceeding.
Do not move to the next step until all verify strings pass.
Respect the do_not constraints exactly.

[paste JSON plan here]
```
```

- [ ] **Step 2: Verify the file looks correct**

Read `.claude/skills/plan-with-tests/SKILL.md`. Confirm:
- Frontmatter present with `name`, `description`
- All 6 process steps present
- Hard rules present (4 rules)
- Plan format JSON present with `verify.passes_when` as array
- Handoff prompt template present

- [ ] **Step 3: Verify the skill is discoverable**

Run:
```bash
ls .claude/skills/
```
Expected output includes `plan-with-tests/` alongside `test/` and `review/`.

- [ ] **Step 4: Commit**

```bash
git add .claude/skills/plan-with-tests/SKILL.md
git commit -m "feat: add plan-with-tests skill for verified Continue.dev handoffs"
```
