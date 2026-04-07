# Hybrid Routing: Claude Code + Continue.dev + Qwen3.5

## Decision Table

| Task | Tool | Reason |
|------|------|--------|
| Autocomplete (any file) | Continue.dev / Qwen3.5 | Free, local, zero latency |
| Inline edit <50 lines | Continue.dev / Qwen3.5 | Local model handles it |
| Single-file refactor | Continue.dev / Qwen3.5 | Use `@file` context |
| Debugging (known error) | Continue.dev / Qwen3.5 | Paste error + `@file` |
| Writing tests (known pattern) | Continue.dev / Qwen3.5 | Template-based work |
| Multi-file refactor | Claude Code | Cross-file reasoning |
| Architecture / new feature design | Claude Code + `superpowers:brainstorming` | Skills + memory |
| RLS / database schema changes | Claude Code | Requires ARCHITECTURE.md context |
| Agent orchestration / subagents | Claude Code | Superpowers required |
| UI component design | Claude Code + `frontend-design` | Plugin required |
| Memory recall / project history | Claude Code + memsearch | Plugin required |
| Context getting large | Claude Code + context-mode | `ctx_execute` saves tokens |
| Approaching usage limit | Continue.dev / Qwen3.5 | Switch immediately |

**Fallback to codex@openai-codex:** isolated generation tasks (regex, boilerplate, one-off scripts) where neither local Qwen3.5 nor Claude Code is already open.

---

## Continue.dev config.yaml (add to ~/.continue/config.yaml)

```yaml
# Models
models:
  - name: Qwen2.5-Coder (local)
    provider: ollama
    model: qwen2.5-coder:latest
    roles:
      - chat
      - edit
      - apply
      - summarize

  # Uncomment only for high-stakes tasks — routes to Anthropic API
  # - name: Claude Sonnet (remote)
  #   provider: anthropic
  #   model: claude-sonnet-4-6
  #   roles:
  #     - chat

# Tab autocomplete — always local
tabAutocomplete:
  model: Qwen2.5-Coder (local)
  disable: false
  multilineCompletions: "auto"

# Codebase embeddings — local, no cost
embeddingsProvider:
  provider: ollama
  model: nomic-embed-text

# Context providers — lean set, expand as needed
contextProviders:
  - name: codebase        # semantic search across repo
    params:
      nRetrievedFiles: 8
  - name: diff            # current git diff
  - name: open            # open editor tabs
  - name: tree            # file tree
  - name: terminal        # last terminal output
  - name: problems        # VSCode diagnostics

# Slash commands for common workflows
slashCommands:
  - name: plan
    description: "Output implementation plan for handoff to Claude Code"
  - name: edit
    description: "Edit highlighted code"
  - name: comment
    description: "Add comments to code"
```

### Launch Ollama + Qwen3.5
```bash
# Pull model (one-time)
ollama pull qwen2.5-coder:latest
ollama pull nomic-embed-text

# Start (auto-starts on macOS login if installed via brew)
ollama serve
```

---

## Token-Minimization Protocols

### In Claude Code
- Always call `memsearch` before exploring codebase — avoids re-reading known context
- Use `ctx_execute_file` instead of Read+Bash for analysis (keeps output in sandbox)
- Keep responses ≤350 tokens; use JSON plans for complex outputs
- Trigger `/compact` when context >50% full; use `PreCompact` hook (see settings.json)
- After planning: output JSON task list → hand off to Continue.dev

### In Continue.dev
- Use `@codebase` for semantic search instead of manual `@file` chains
- Use `@diff` to scope context to current changes only
- Keep chat history short — `/clear` after each task
- Use inline edit (cmd+I) instead of chat for targeted changes

### Structured plan format for handoff
When Claude Code plans something for Continue.dev to implement:
```json
{
  "task": "description",
  "files": ["path/to/file1.ts", "path/to/file2.tsx"],
  "steps": [
    "Step 1: what to change in file1.ts",
    "Step 2: what to change in file2.tsx"
  ],
  "constraints": ["don't change RLS policies", "keep Zod schema in sync"]
}
```
Paste this into Continue.dev chat with `@file` mentions for each file.

---

## Prompt Templates

### High-level planning (Claude Code)
```
Plan only. No code yet.
Task: [what needs to happen]
Constraints: [relevant rules from ENTERPRISE_PRINCIPLES.md or ARCHITECTURE.md]
Output: JSON task list for Continue.dev implementation.
```

### Implementation handoff (Continue.dev)
```
Implement this plan using the files below. Follow the constraints exactly.
[paste JSON plan from Claude Code]
@file [path1] @file [path2]
```

### Refactor (Continue.dev)
```
Refactor @file [path] to [goal].
Keep existing tests passing. No new abstractions.
```

### Debugging (Continue.dev)
```
Error: [paste exact error]
@file [the file throwing it]
Diagnose root cause. Show fix only for the root cause, nothing else.
```

### New feature (Claude Code → Continue.dev)
```
# Claude Code
Feature: [what it does]
Read: ARCHITECTURE.md, ENTERPRISE_PRINCIPLES.md
Recall memory. Plan only. Output JSON task list.

# Continue.dev (after getting plan)
Implement step [N] from plan:
[paste step]
@file [relevant files]
```

### Onboarding new context (Claude Code)
```
New session. Recall project memory. Read BUILD_STATUS.md.
Summarize: what's done, what's in progress, what's blocked.
Output in ≤200 tokens.
```

---

## Monitoring & Limit Detection

Claude Code self-check signals (apply proactively):
- If this response is likely >400 tokens → use JSON instead of prose
- If reading a 3rd file in a row for analysis → switch to `ctx_execute_file`
- If the task is purely mechanical (find-replace, rename, format) → route to Continue.dev
- If approaching end of session → run `/compact` and save key decisions to memory

### PreCompact hook (in ~/.claude/settings.json)
Fires before auto-compaction with a reminder to save context:
```json
"PreCompact": [{
  "hooks": [{
    "type": "command",
    "command": "echo '{\"systemMessage\": \"About to compact. Save key decisions/blockers to memory now (Write tool). Run /context-mode:ctx-stats to see what was saved.\"}'"
  }]
}]
```
