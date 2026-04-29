---
name: pr-review-agent
description: Adversarial PR review walked by the orchestrating Claude Code session — fetches the diff, then chains tool calls (Bash, Grep, Read) across RLS policies, pgTAP coverage, PHI sinks, and the BACKLOG row to produce a Critical/Medium/Low report. Read-only. No external API key — runs under your existing subscription. Invoke as `/pr-review-agent <pr-number>`.
---

# pr-review-agent

This skill is a **workflow the current session executes itself** — there is NO separate script and NO Anthropic API call. The "tool-use loop" IS this Claude Code session walking the steps below.

## When to use

- Sanity-check a PR before adding the `queue` label.
- Comparison run alongside `/review` to validate findings.

Do NOT use as the sole gate on PHI/RLS-touching PRs — `/review` and `rls-reviewer` remain canonical.

## Prerequisites

- `gh` CLI authenticated
- Local Supabase running (`supabase start`) — needed for the RLS lookups
- Run from repo root

## Workflow — execute these steps verbatim, in order

### 1. Fetch the diff

```sh
gh pr diff <pr-number>
```

Read it. Identify:
- Which files changed
- Whether the diff touches a Supabase migration (look for `supabase/migrations/*.sql`)
- Which Postgres tables are referenced (especially PHI tables: `care_events`, `care_event_comments`, `recipients`, `identities`, `organizations`, `messages`, `medications`, `mar_records`)
- Whether analytics / logging code is touched (search the diff for `posthog`, `Sentry.captureException`, `console.log`)
- The story ID in the PR title (e.g. `TD-85`, `A11Y-012`)

### 2. For each PHI table touched, dump RLS + pgTAP coverage

```sh
psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -c "
SELECT polname, polcmd, pg_get_expr(polqual, polrelid) AS using_expr,
       pg_get_expr(polwithcheck, polrelid) AS check_expr
FROM pg_policy WHERE polrelid = '<TABLE>'::regclass;"
```

```sh
grep -rln "<TABLE>" supabase/tests/ --include='*.sql'
```

If pgTAP returns nothing for a PHI table that the migration changed → **Critical** (no regression net).

### 3. PHI-sink scan on changed files

For each changed `apps/web/**/*.{ts,tsx}` file:

```sh
grep -nE "posthog\.(identify|capture)|supabaseAdmin|Sentry\.captureException|console\.log.*\b(email|name|phone|dob|address)\b" <files>
```

Failures:
- `posthog.identify(<non-uuid>)` or `posthog.capture('event', { email | name | phone | … })` → **Critical**
- `supabaseAdmin` outside `apps/web/server/` or `apps/web/app/api/` → **Critical**
- `console.log` of user-shaped objects in client code → **Medium**
- `Sentry.captureException` with potentially PHI-bearing context → **Medium** (verify the surrounding code scrubs it)

### 4. RLS expression sanity check

For each policy returned in step 2, verify the `using_expr` / `check_expr`:
- Filters by `org_id`, `recipient_id`, or `auth.uid()` — never global
- `INSERT` / `UPDATE` policies have a `WITH CHECK` not just `USING`
- No `true` policies on PHI tables

### 5. Backlog cross-check

```sh
grep "<STORY-ID>" BACKLOG.md
```

Read the row. Does the diff scope match what the row promises? Flag scope creep as **Medium** ("scope-check").

### 6. Emit the report

Write a single markdown report to stdout:

```
# PR <num> Review

**Verdict:** APPROVE | REQUEST CHANGES | BLOCK

## Critical
- [file:line] <issue> — <suggested fix>
(or "(none)")

## Medium
- ...

## Low
- ...

## Scope check
- Backlog row: <id> — <does diff match? yes / scope-creep / missing-row>

## Tool calls made
- N: <list>
```

## Hard rules during the walk

- **No Edit/Write tools.** Read-only review. If you find yourself wanting to fix something, stop and write the finding.
- **Stop calling tools when you have enough evidence.** Don't over-investigate.
- **If local Supabase isn't running**, skip step 2/4 and note it as a Limitation in the report — don't block on it.

## Why a skill, not a script

Internal review tooling does not call the Anthropic API directly. The orchestrating session IS the agent — Bash/Grep/Read are its tools, this SKILL.md is its system prompt. No separate `ANTHROPIC_API_KEY`, no per-call billing. (See feedback memory `feedback_no_direct_anthropic_api.md`.)
