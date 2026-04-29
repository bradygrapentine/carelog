---
name: pr-review-agent
description: Tool-use Claude agent (Sonnet) that reviews a GitHub PR by chaining diff → RLS policies → pgTAP coverage → PHI sinks → backlog cross-check. Runs alongside /review for comparison; does NOT replace it. Output mirrors /review Critical/Medium/Low report shape. Invoke as `/pr-review-agent <pr-number>`. Local Supabase must be running for RLS lookups.
---

# pr-review-agent

Adversarial PR reviewer built on the Anthropic threat-intel cookbook pattern (tool-use loop + multi-source fan-out).

## When to use

- Comparison run alongside `/review` to validate the agentic-loop approach.
- Quick sanity-check on a PR before it enters the queue.

Do NOT use as the sole gate — `/review` and `rls-reviewer` agent remain canonical for PHI/RLS-touching PRs.

## Prerequisites

- `ANTHROPIC_API_KEY` set
- `gh` CLI authenticated (`gh auth status`)
- Local Supabase running (`supabase start`) for RLS lookups
- Run from repo root

## Invocation

```sh
node apps/web/scripts/agents/pr-review-agent.mjs <pr-number>
```

The agent prints its final Critical/Medium/Low report to stdout; tool-call trace goes to stderr.

## Tools the agent has

1. `get_pr_diff(pr_number)` — `gh pr diff`, truncated at 200KB
2. `get_rls_policies(table)` — `psql` against local Supabase
3. `get_pgtap_coverage(table)` — grep `supabase/tests/`
4. `find_phi_sinks(files?)` — grep for posthog.identify/capture, supabaseAdmin, console.log of PHI, Sentry.captureException
5. `get_related_backlog(story_id)` — grep BACKLOG.md

## Limits

- `MAX_TURNS = 12`, `max_tokens = 4096` per turn
- Uses Sonnet 4-6
- No write tools — read-only review

## Known gaps (v1)

- Doesn't fetch PR comments / prior review history
- Doesn't run tests or typecheck
- Doesn't compare against the codex-runs/ history for repeat findings
