@docs/project-info/CLAUDE.md

## Plan Mode Default

Enter plan mode for any task requiring 3+ file changes or architectural decisions. For simple single-file edits, proceed directly.

## Subagent Strategy

Dispatch parallel subagents only for genuinely independent tasks (different files, no shared state). Max 2 background agents per session. Prefer inline execution for tasks under 5 steps.

## Self-Improvement Loop

After any session with a correction: update CLAUDE.md or memory immediately. Do not wait for next session.

## Verification Before Done

Run verification commands before claiming anything is complete. Use `superpowers:verification-before-completion` before any commit or "done" claim.

## Demand Elegance (Balanced)

Prefer simple, direct code. No speculative abstractions. No helpers for one-time operations. Three similar lines beat a premature abstraction.

## Autonomous Bug Fixing

Diagnose root cause before fixing. Read the error. Check assumptions. Don't retry identical actions. Escalate to user only after investigation.

## Task Management

Use TodoWrite for multi-step tasks (3+ steps). Mark complete immediately after each step. Don't batch completions.

## Core Principles

### Plugin priority (always in this order):
1. **memsearch** — recall relevant memory before any codebase exploration
2. **context-mode** — use `ctx_execute`/`ctx_execute_file` for any output >20 lines; never Bash/Read for analysis
3. **superpowers** — invoke matching skill before any response; brainstorm before features; debug before fixes
4. **frontend-design** — only for explicit UI/frontend design requests
5. **codex** — fallback for isolated, well-scoped code generation

### Token discipline:
- Response cap: ≤350 output tokens unless user explicitly requests more
- Use structured output (JSON task lists) for complex plans — enables direct handoff to Continue.dev
- Trigger `context-mode:ctx-stats` if context feels large; trigger `/compact` proactively
- When a task is purely implementation (no architecture decisions), output the plan then add: **"→ Implement in Continue.dev with Qwen3.5"**

### Handoff triggers to Continue.dev:
- Autocomplete or inline edits → Continue.dev (never Claude Code)
- Single-file refactor with no cross-file dependencies → Continue.dev
- Routine debugging with a known error message → Continue.dev
- Any task where you've already output the full plan → Continue.dev

### Stay in Claude Code for:
- Multi-file architecture changes
- Plugin orchestration (memsearch recall, subagent dispatch)
- Anything requiring superpowers skills
- Explicit UI/design work with frontend-design plugin