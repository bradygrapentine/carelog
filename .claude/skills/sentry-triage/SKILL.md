---
name: sentry-triage
description: Tool-use Claude agent (Sonnet) that triages a Sentry issue end-to-end. Given an issue URL, fetches the issue + stack trace, runs git blame on the in-app frame, finds the related PR, checks BACKLOG.md for an existing row, then emits structured JSON + a draft TD-* row. Read-only — does NOT write back to Sentry, GitHub, or BACKLOG.md. Invoke as `/sentry-triage <sentry-issue-url>`.
---

# sentry-triage

Sentry → backlog story converter built on the Anthropic threat-intel cookbook pattern (tool-use loop + multi-source fan-out).

## When to use

- A Sentry alert fires and you want a backlog-ready story without manual pivoting across Sentry → git blame → `gh pr list` → BACKLOG grep.
- Bulk triage of a Sentry issue list (loop the script over URLs).

Do NOT use for: incidents in progress (use `/review` or pageable channels), or PHI-leak suspicions (escalate to a human first).

## Prerequisites

- `ANTHROPIC_API_KEY` set
- `SENTRY_AUTH_TOKEN` set (Sentry Auth Token with `event:read`, `issue:read`, `org:read` scopes)
- `gh` CLI authenticated
- Run from repo root

## Invocation

```sh
node apps/web/scripts/agents/sentry-triage-agent.mjs <sentry-issue-url>
```

Stdout: structured JSON (severity, phi_risk, evidence, draft_row, …).
Stderr: tool-call trace + the draft BACKLOG row pretty-printed.

## Tools the agent has

1. `get_sentry_issue(issue_url)` — Sentry REST `/issues/`
2. `get_recent_events(issue_id, org_slug, limit)` — Sentry REST `/issues/{id}/events/`
3. `git_blame(file, line)` — `git blame -L <line>,<line> -- <file>`
4. `find_related_pr(file)` — `gh pr list --state merged --search <file>`
5. `find_related_backlog(keywords)` — grep BACKLOG.md

## Output shape

```json
{
  "severity": "Critical" | "Medium" | "Low",
  "phi_risk": true | false,
  "title": "...",
  "existing_backlog_row": "TD-37" | null,
  "evidence": [{"file": "...", "line": 42, "blame_sha": "...", "pr": 192}],
  "suggested_owner": "web" | "mobile" | "supabase" | "infra",
  "draft_row": "TD-XX | 🟢 Ready | **<title>** | <notes>",
  "tools_used": 4
}
```

## Limits (v1)

- `MAX_TURNS = 10`
- No write-back to Sentry / GitHub / BACKLOG.md — human commits the draft row in a `chore(backlog):` PR.
- Doesn't consult Sentry Seer (`mcp__sentry__analyze_issue_with_seer`) — script can't invoke MCP tools.
- Severity rubric is fixed in the system prompt; tune there if it gets noisy.

## Severity rubric (current)

- **Critical** — PHI exposure, payment failure, RLS bypass, auth bypass, data loss, prod-only outage affecting >1% of sessions
- **Medium** — feature broken but workaround exists, single-org impact, non-PHI errors >100/day
- **Low** — cosmetic, single-event noise, dev-only error
