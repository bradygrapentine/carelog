---
name: routing-report
description: Weekly analysis of .claude/routing-metrics.jsonl — model usage histogram, prompt-size distribution, Haiku block events, Opus-on-mechanical blocks, and suggestions for routing.yaml tweaks. Run weekly (or on demand) to catch routing drift and update the hard rules / archetype weights.
user-invocable: true
---

# Routing Report

Read `.claude/routing-metrics.jsonl`, summarize, and suggest `.claude/routing.yaml` updates.

**Announce at start:** "Using /routing-report to analyze this week's Agent dispatch pattern."

## When to run

- Weekly (via `/schedule routing-report "0 9 * * 1"` — Monday 9am).
- On demand when a session felt expensive — inspect which model got what.
- Before tweaking `routing.yaml` — know the data before editing the rule.

## Arguments

`/routing-report [days]` — default 7.

## Process

### 1. Read metrics

```sh
MET=.claude/routing-metrics.jsonl
[ ! -f "$MET" ] && { echo "No metrics yet. Hook fires on the next Agent dispatch."; exit 0; }

# Filter to last N days
since=$(date -u -v-${DAYS:-7}d +%Y-%m-%dT00:00:00Z 2>/dev/null || date -u -d "${DAYS:-7} days ago" +%Y-%m-%dT00:00:00Z)
```

### 2. Compute summaries

Use `ctx_execute` (python) to parse the JSONL. Do NOT cat/jq it in the chat — that's the kind of bulk processing context-mode handles.

For the window:
- **Total dispatches**, **distinct days active**
- **By model**: count, median prompt size, p95 prompt size
- **By description keyword cluster**: `rename|refactor|review|implement|test|debug|docs` → count + median size
- **Block events**: how many Agent calls did the `route-model-log.sh` hook block this week?
  - Haiku-oversize blocks: count
  - Opus-mechanical blocks: count

### 3. Detect drift

Compare against `.claude/routing.yaml` archetypes:
- If >10% of multi-file-implementation tasks are going to Haiku → manifest is being ignored
- If any block rate is very high → the threshold is too aggressive or a common pattern is mis-classified
- If Opus is being used for tasks <2000 chars → flag — cheap model would have been fine

### 4. Emit the report

```markdown
# Routing report — <date>..<date> (N days)

## Volume
Total dispatches: N  | Unique days: N

## By model
| Model   | Count | Median prompt | P95 prompt | Share |
|---------|-------|---------------|------------|-------|
| opus    |   …   |       …       |     …      |   …   |
| sonnet  |   …   |       …       |     …      |   …   |
| haiku   |   …   |       …       |     …      |   …   |

## Blocks fired
- Haiku-oversize blocks: N
- Opus-mechanical blocks: N

## Top description clusters
- implement (N)
- review (N)
- refactor (N)
…

## Suggestions
- [if applicable] Consider lowering HAIKU_CHAR_LIMIT from 6000 to 5000 — 12 near-misses this week
- [if applicable] Add keyword "deploy" to OPUS_MECHANICAL_PATTERNS — Opus used for 3 deploy-only tasks
- [if none] No changes recommended — routing looks healthy.

## Raw totals
_File: .claude/routing-metrics.jsonl, N lines_
```

### 5. Do NOT auto-edit routing.yaml

Suggestions are just that. The user decides which to apply. If they want a change, they can invoke `/update-config` or edit directly.

## Rules

- Read-only skill — no edits to any file.
- If `routing-metrics.jsonl` is empty, say so and exit cleanly.
- Keep the report terse — 30-50 lines of markdown, not a data dump.

## Integrations

- `route-model-log.sh` — the hook that writes the metrics this skill reads
- `.claude/routing.yaml` — the manifest whose thresholds this skill recommends tuning
