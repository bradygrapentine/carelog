# Token Discipline

How to split work between Claude Code (planning, orchestration, complex multi-file changes) and Continue.dev (mechanical edits, autocompletes, single-file work).

## Budget

- Response cap: ≤350 tokens unless the task demands more
- When approaching a session limit: run `/compact`, save key decisions to memory, then continue

## Routing

**Stay in Claude Code for:**
- Multi-file architecture and refactors
- Plugin/skill orchestration
- RLS or schema changes
- UI component design (`/frontend-design`)
- Anything that needs the superpowers workflow

**Hand off to Continue.dev for:**
- Autocomplete and inline edits (<50 lines)
- Single-file refactors
- Known-error debugging
- Writing tests against an existing, well-understood pattern

## Self-check signals

| Signal | Action |
|---|---|
| Response likely >400 tokens | Use JSON/tables instead of prose |
| Reading a 3rd file in a row for analysis | Switch to `ctx_execute_file` |
| Task is purely mechanical (rename, format, boilerplate) | Route to Continue.dev |
| Approaching end of session | `/compact`, save decisions, continue |

## Continue.dev handoff plan format

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
          "exact test name string 2"
        ]
      },
      "do_not": ["explicit scope boundary 1", "explicit scope boundary 2"]
    }
  ]
}
```

- `passes_when` strings must match Vitest output exactly. All must pass.
- For pgTAP steps use `supabase test db` as the command.
- Commit failing tests before handing off — Continue.dev must start red.

## Handoff prompt

```
Implement this plan step by step. After each step, run the verify command
and confirm every string in passes_when appears in the output before proceeding.
Do not move to the next step until all verify strings pass.
Respect the do_not constraints exactly.

[paste JSON plan here]
```

## Permission-scope notes

- `Bash(*)` allows ALL shell commands without approval — including destructive ones like `rm -rf`. Prefer scoped patterns: `Bash(grep:*)`, `Bash(find:*)`.
- `Read`, `Grep`, `Glob` are read-only — safe to blanket-allow.
- `Edit` and `Write` modify files without approval — scope carefully.
- Project-level scoping goes in `.claude/settings.json`.
