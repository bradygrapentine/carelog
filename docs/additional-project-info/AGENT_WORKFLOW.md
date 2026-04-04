# Claude Code — Agent & Session Workflow

## When to use what

| Task | Use |
|------|-----|
| Single focused task (write tests for one file, fix one bug) | Interactive session (normal) |
| One module's tests, run-until-green | `./scripts/ai-test.sh unit <path>` |
| Multiple independent modules simultaneously | `./scripts/ai-test.sh parallel unit <path1> <path2>` |
| Cross-layer work (auth change affecting mobile + web + backend) | Parallel Agent tool calls in one session |
| Research / codebase exploration | Spawn an `Explore` subagent to protect main context |

## Parallel Agent tool calls

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
3. **Iterative test debugging burning context** — use headless scripts that run autonomously

When context pressure is building: summarize the current state in a message, then use /compact.

## Memory

Persistent memory lives in `~/.claude/projects/.../memory/`. The system automatically saves:
- User preferences and working style
- Project decisions and context
- Feedback from corrections

This persists across sessions without any explicit action needed.

## Code review

To get an independent review of a file or change:
```bash
claude -p "
Review this file for bugs, security issues, and test coverage gaps.
Read: <file-path>
Report findings as: [CRITICAL] / [WARN] / [SUGGESTION]
Do not make any changes — report only.
" --allowedTools "Read,Grep,Glob"
```

## Role decomposition

When decomposing a large task by layer:
- Name the scope explicitly in the prompt ("only touch apps/web/app/api/")
- Tell each agent what the other agents are doing, so it doesn't overreach
- Have the main session synthesize results — don't chain agents to each other
