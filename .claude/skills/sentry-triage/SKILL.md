---
name: sentry-triage
description: Sentry-issue triage walked by the orchestrating Claude Code session — fetches the issue + stack trace via the Sentry REST API, then chains git blame, gh pr list, and BACKLOG grep to produce a structured JSON report + draft TD-* row. Read-only — does NOT write back to Sentry, GitHub, or BACKLOG.md. No external API key needed for the LLM (the session IS the agent). Invoke as `/sentry-triage <sentry-issue-url>`.
---

# sentry-triage

This skill is a **workflow the current session executes itself** — there is NO separate script and NO Anthropic API call. The session walks the steps below using its built-in Bash/Read/Grep tools.

## When to use

- A Sentry alert fires and you want a backlog-ready story without manually pivoting through Sentry → git blame → `gh pr list` → BACKLOG grep.

Do NOT use for: incidents in progress (use `/review` or pageable channels), or PHI-leak suspicions (escalate to a human first).

## Prerequisites

- `SENTRY_AUTH_TOKEN` set (Sentry user-auth token with `event:read`, `issue:read`, `org:read` scopes — the build-plugin tokens do NOT have these scopes; generate a new one at https://sentry.io/settings/account/api/auth-tokens/ if needed)
- `SENTRY_ORG` set (the org slug)
- `gh` CLI authenticated
- Run from repo root

The Sentry API base for the Carelog org is `https://us.sentry.io/api/0` (not the bare `sentry.io` host — the org is region-pinned to US).

## Workflow — execute these steps verbatim, in order

### 1. Parse the URL + fetch the issue

The URL takes one of two forms; extract `org_slug` + `issue_id`:
- `https://<org>.sentry.io/issues/<id>/` → org from subdomain
- `https://sentry.io/organizations/<org>/issues/<id>/`

Fetch the issue. Write a tiny `.mjs` to `/tmp/` so the inline-fetch hook doesn't block, OR use a one-shot `node` script file. Example template:

```js
// /tmp/sentry-fetch.mjs
const t = process.env.SENTRY_AUTH_TOKEN;
const id = process.argv[2];
const r = await fetch(`https://us.sentry.io/api/0/issues/${id}/`, { headers: { Authorization: "Bearer " + t } });
const d = await r.json();
console.log(JSON.stringify({
  shortId: d.shortId, title: d.title, level: d.level, count: d.count,
  userCount: d.userCount, culprit: d.culprit, firstSeen: d.firstSeen, lastSeen: d.lastSeen,
  metadata: d.metadata,
}, null, 2));
```

Run with `node /tmp/sentry-fetch.mjs <id>`.

### 2. Pull the most recent event for a stack trace

```js
// /tmp/sentry-event.mjs
const t = process.env.SENTRY_AUTH_TOKEN;
const id = process.argv[2];
const r = await fetch(`https://us.sentry.io/api/0/issues/${id}/events/?limit=1`, { headers: { Authorization: "Bearer " + t } });
const [evt] = await r.json();
const exc = evt?.entries?.find(e => e.type === "exception")?.data?.values?.[0];
console.log(JSON.stringify({
  type: exc?.type, value: exc?.value,
  stack: exc?.stacktrace?.frames?.filter(f => f.inApp).map(f => ({
    file: f.filename, line: f.lineno, fn: f.function, ctx: f.context_line,
  })),
}, null, 2));
```

Pick the topmost in-app frame whose path is under `apps/web/`, `apps/mobile/`, or `supabase/`.

### 3. git blame the failing line

```sh
git blame -L <line>,<line> -- <file>
```

Capture the SHA + author + commit subject.

### 4. Find PRs that touched the file recently

```sh
gh pr list --state merged --limit 10 --search "<file>" --json number,title,mergedAt
```

### 5. Check BACKLOG.md for an existing row

```sh
grep -i "<keyword-from-title>" BACKLOG.md | head -10
```

### 6. Severity rubric

- **Critical** — PHI exposure, payment failure, RLS bypass, auth bypass, data loss, prod outage affecting >1% of sessions
- **Medium** — feature broken with workaround, single-org impact, non-PHI errors >100/day
- **Low** — cosmetic, single-event noise, dev-only, or browser-permission-denied UX errors

### 7. Emit the JSON

Write a single JSON block to stdout:

```json
{
  "severity": "Critical" | "Medium" | "Low",
  "phi_risk": true | false,
  "title": "<one-line summary>",
  "existing_backlog_row": "TD-37" | null,
  "evidence": [
    { "file": "<path>", "line": 42, "blame_sha": "<sha>", "pr": 192 }
  ],
  "suggested_owner": "web" | "mobile" | "supabase" | "infra",
  "draft_row": "| TD-XX | 🟢 Ready | **<title>** | <notes — root cause, fix sketch, est hours> |",
  "tools_used": <int>
}
```

The `draft_row` is a markdown table row matching the BACKLOG.md §1 format. Human commits it via a `chore(backlog): …` PR.

## Hard rules during the walk

- **No Edit/Write to source files.** Read-only triage. Drafting `/tmp/*.mjs` helper scripts for the Sentry fetch is fine.
- **Never paste the SENTRY_AUTH_TOKEN into stdout / logs.**
- **If the token has insufficient scope** (403), stop and report — don't try other endpoints.

## Why a skill, not a script

Internal triage tooling does not call the Anthropic API directly. The orchestrating session IS the agent — Bash/Grep/Read are its tools, this SKILL.md is its system prompt. No `ANTHROPIC_API_KEY`, no per-call billing. (See feedback memory `feedback_no_direct_anthropic_api.md`.)
