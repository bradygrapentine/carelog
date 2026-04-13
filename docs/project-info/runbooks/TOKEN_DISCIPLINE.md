# Token Discipline

How to split work between Claude Code (planning, orchestration, complex multi-file changes) and Ollama (mechanical edits, autocompletes, single-file work).

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

## Self-check signals

| Signal | Action |
|---|---|
| Response likely >400 tokens | Use JSON/tables instead of prose |
| Reading a 3rd file in a row for analysis | Switch to `ctx_execute_file` |
| Task is purely mechanical (rename, format, boilerplate) | Route to ollama agents |
| Approaching end of session | `/compact`, save decisions, continue |

## Permission-scope notes

- `Bash(*)` allows ALL shell commands without approval — including destructive ones like `rm -rf`. Prefer scoped patterns: `Bash(grep:*)`, `Bash(find:*)`.
- `Read`, `Grep`, `Glob` are read-only — safe to blanket-allow.
- `Edit` and `Write` modify files without approval — scope carefully.
- Project-level scoping goes in `.claude/settings.json`.
