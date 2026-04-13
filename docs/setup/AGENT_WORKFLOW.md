# Claude Code — Agent & Session Workflow

## When to use what

| Task                                                            | Use                                                                                          |
| --------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Single focused task (write tests for one file, fix one bug)     | Interactive session (normal)                                                                 |
| One module's tests, run-until-green                             | Dispatch via `/ollama` (mechanical) or Task subagent                                         |
| Multiple independent failures                                   | Parallel subagents via `superpowers:dispatching-parallel-agents`; prefer `/ollama` per file  |
| Cross-layer work (auth change affecting mobile + web + backend) | Parallel Agent tool calls in one session                                                     |
| Research / codebase exploration                                 | Spawn an `Explore` subagent (or `/ollama`) to protect main context                           |
| Mechanical edits (<50 lines, single file, known pattern)        | `/ollama`                                                            |
| Multi-file implementation with tests                            | Claude Code + `plan-with-tests` skill → Sonnet subagent (`Task` tool) or `/ollama` per-file |

## Parallel Agent tool calls

Parallel subagents via `superpowers:dispatching-parallel-agents` are the primary background-work mechanism. Use `/ollama` for local model dispatch on mechanical/exploratory subtasks; use the Task tool for judgment-heavy work that needs full project context.

When a session requires simultaneous independent work across layers, use the Agent tool with multiple calls in a single message. Each agent gets its own context window.

Example: auth refactor touching three layers

- Agent 1: "Update the web auth flow in apps/web/..."
- Agent 2: "Update the mobile auth flow in apps/mobile/..."
- Agent 3: "Update the API routes in apps/web/app/api/..."

All three run in parallel. Synthesize their results back in the main session.

## Session limit prevention

The main reasons sessions hit rate/context limits:

1. **Packing multiple deliverables into one session** — scope each session to one module or one feature
2. **Reading entire files when only snippets are needed** — use Grep/Glob before Read
3. **Iterative test debugging burning context** — dispatch to `/ollama` or a Task subagent

When context pressure is building: summarize the current state in a message, then use /compact.

## Memory

Persistent memory lives in `~/.claude/projects/.../memory/`. The system automatically saves:

- User preferences and working style
- Project decisions and context
- Feedback from corrections

Recall memory at session start via the `memsearch` plugin before exploring the codebase.

## Code review

| Review type               | Command                                               |
| ------------------------- | ----------------------------------------------------- |
| Security + PHI boundary   | `/review` skill (parallel subagents)                  |
| Design + assumptions      | `/review` skill (parallel subagents)                  |
| General code quality      | `/review` skill                                       |
| Plan implementation check | Dispatch a Task subagent to diff HEAD against the plan file in `docs/superpowers/plans/` |
| Manual interactive review | Use `review` skill (`.claude/skills/review/SKILL.md`) |

## Role decomposition

When decomposing a large task by layer:

- Name the scope explicitly in the prompt ("only touch apps/web/app/api/")
- Tell each agent what the other agents are doing, so it doesn't overreach
- Have the main session synthesize results — don't chain agents to each other
