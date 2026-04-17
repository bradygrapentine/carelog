#!/bin/bash
# PreToolUse hook for the Agent tool.
# - Logs the dispatch (model, description, prompt length) to .claude/routing-metrics.jsonl
# - Prints a warning (systemMessage) if Haiku is chosen for a large prompt
#   (the "Haiku blew context" friction pattern from the insights report)
#
# Never REWRITES the invocation — silent rewrites are worse than mismatches.
# The warning nudges the user; they override by re-running if they meant it.

set -e

REPO_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
METRICS="$REPO_DIR/.claude/routing-metrics.jsonl"

payload=$(cat)

# Only act on the Agent tool
tool=$(echo "$payload" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('tool_name',''))" 2>/dev/null)
[ "$tool" != "Agent" ] && exit 0

# Extract params
read -r model description prompt_len < <(echo "$payload" | python3 -c "
import sys, json
d = json.load(sys.stdin)
ti = d.get('tool_input', {})
model = ti.get('model', 'inherit')
desc = (ti.get('description', '') or '').replace('\n', ' ')[:80]
prompt = ti.get('prompt', '') or ''
print(model, desc, len(prompt))
" 2>/dev/null || echo "inherit unknown 0")

# Append metric line
ts=$(date -u +%Y-%m-%dT%H:%M:%SZ)
printf '{"ts":"%s","model":"%s","prompt_chars":%s,"description":"%s"}\n' \
  "$ts" "$model" "$prompt_len" "$description" >> "$METRICS" 2>/dev/null || true

# Warn if Haiku + big prompt (> 6000 chars ≈ 1500 tokens, the rough limit Haiku hits on worktree tasks)
if [ "$model" = "haiku" ] && [ "$prompt_len" -gt 6000 ]; then
  printf '{"systemMessage": "[routing] Dispatching Haiku with %s-char prompt — prior sessions hit context limits at this size. Consider model: sonnet for this task."}' "$prompt_len"
fi

exit 0
