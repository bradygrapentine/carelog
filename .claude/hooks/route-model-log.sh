#!/bin/bash
# PreToolUse hook for the Agent tool.
# - Logs every dispatch (model, description, prompt length) to .claude/routing-metrics.jsonl
# - BLOCKS Haiku with >6000-char prompts (the "Haiku blew context" friction pattern);
#   Claude will re-read the block reason and re-issue with Sonnet.
# - BLOCKS Opus used for obviously mechanical work (keyword match on description).
# - Override for both: set CLAUDE_ALLOW_MODEL_MISMATCH=1 before the Agent call.
#
# The hook NEVER silently rewrites. It blocks with an explanation so Claude stays
# in control of the retry. The decision + reason JSON is how Claude Code
# surfaces the block to the model.

set -e

REPO_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
METRICS="$REPO_DIR/.claude/routing-metrics.jsonl"
HAIKU_CHAR_LIMIT=6000
OPUS_MECHANICAL_PATTERNS='rename|stub|boilerplate|scaffold|move file|add type|format|lint fix|test boilerplate'

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

# Append metric line (always, even when blocked — so /routing-report sees blocks)
ts=$(date -u +%Y-%m-%dT%H:%M:%SZ)
printf '{"ts":"%s","model":"%s","prompt_chars":%s,"description":"%s"}\n' \
  "$ts" "$model" "$prompt_len" "$description" >> "$METRICS" 2>/dev/null || true

# Honor override
[ "${CLAUDE_ALLOW_MODEL_MISMATCH:-0}" = "1" ] && exit 0

# Block: Haiku + large prompt (repeatedly hit context limits in prior sessions)
if [ "$model" = "haiku" ] && [ "$prompt_len" -gt "$HAIKU_CHAR_LIMIT" ]; then
  printf '{"decision":"block","reason":"[routing] Blocked: Haiku with %s-char prompt. Prior sessions hit Haiku context limits above ~%s chars on worktree tasks. Retry this Agent call with model: sonnet. Override: set CLAUDE_ALLOW_MODEL_MISMATCH=1 if you truly want Haiku here."}' \
    "$prompt_len" "$HAIKU_CHAR_LIMIT"
  exit 2
fi

# Block: Opus used for mechanical work (based on description keywords)
if [ "$model" = "opus" ] && echo "$description" | grep -qiE "$OPUS_MECHANICAL_PATTERNS"; then
  printf '{"decision":"block","reason":"[routing] Blocked: Opus dispatched for a task that reads as mechanical (description matched: %s). Opus should stay on architecture/security/coordination — use model: sonnet or model: haiku for mechanical work. Override: CLAUDE_ALLOW_MODEL_MISMATCH=1."}' \
    "$OPUS_MECHANICAL_PATTERNS"
  exit 2
fi

exit 0
