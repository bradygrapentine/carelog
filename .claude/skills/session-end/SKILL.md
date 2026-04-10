---
name: session-end
description: End-of-session cleanup — revise CLAUDE.md, save memory, summarize decisions, prompt to commit
user-invocable: true
---

# Session End

Run this at the end of every working session.

## Steps

### 1. Revise CLAUDE.md
Invoke the claude-md-management skill to capture any corrections or new rules from this session:
```
/claude-md-management:revise-claude-md
```

### 2. Save memory
Review the conversation for anything worth persisting across sessions:
- New project decisions or architectural choices
- User preferences or feedback on your approach
- Bugs found and their root causes
- Any "now I know" moments

Write relevant entries to `/Users/bradygrapentine/.claude/projects/-Users-bradygrapentine-Documents-projects-carelog/memory/`.

### 3. Summarize decisions
Print a brief (≤5 bullet) summary of key decisions made this session — things that affect future work.

### 4. Run Codex review
If there are uncommitted changes, dispatch a Codex review in the foreground:
```
/codex:review --wait
```
Review findings before committing. Do not auto-fix — present issues and ask which to address.

### 5. Prompt to commit
Check `git status`. If there are uncommitted changes, ask:
> "Uncommitted changes detected. Run `/commit` to commit, or leave for next session?"

### 5. Suggest next session start
Based on what was worked on, suggest the most logical next task by referencing `docs/project-info/product/BUILD_STATUS.md`.
