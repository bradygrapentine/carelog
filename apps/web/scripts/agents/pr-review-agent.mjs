#!/usr/bin/env node
// TD-85 — Tool-use PR review agent.
// Pattern: Anthropic threat-intel cookbook — agent loop with multi-source tool fan-out.
// Runs alongside /review for comparison; does NOT replace it in v1.
//
// Usage: node apps/web/scripts/agents/pr-review-agent.mjs <pr-number>
// Requires: ANTHROPIC_API_KEY in env, gh CLI authenticated, local Supabase running.

import Anthropic from "@anthropic-ai/sdk";
import { execFileSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const MODEL = "claude-sonnet-4-6";
const MAX_TURNS = 12;
const MAX_DIFF_BYTES = 200_000;

const REPO_ROOT = execFileSync("git", ["rev-parse", "--show-toplevel"], { encoding: "utf8" }).trim();

const sh = (cmd, args, opts = {}) => {
  try {
    return execFileSync(cmd, args, { encoding: "utf8", maxBuffer: 10_000_000, ...opts });
  } catch (err) {
    return `__ERROR__: ${err.message}\n${err.stderr || ""}`;
  }
};

// ---------- Tools ----------

const tools = [
  {
    name: "get_pr_diff",
    description:
      "Fetch the unified diff for a GitHub pull request via `gh pr diff`. Returns the full diff truncated at 200KB. Call this FIRST to learn what files the PR touches before deciding which other tools to use.",
    input_schema: {
      type: "object",
      properties: { pr_number: { type: "integer", description: "GitHub PR number" } },
      required: ["pr_number"],
    },
  },
  {
    name: "get_rls_policies",
    description:
      "Query local Supabase Postgres for all RLS policies on a given table. Returns policy name, command (SELECT/INSERT/UPDATE/DELETE), and USING/WITH CHECK expressions. Use whenever the diff modifies a Supabase migration touching a table or modifies a server-side query against a PHI table (care_events, recipients, identities, organizations, etc.).",
    input_schema: {
      type: "object",
      properties: { table: { type: "string", description: "Table name, e.g. 'care_events'" } },
      required: ["table"],
    },
  },
  {
    name: "get_pgtap_coverage",
    description:
      "Find pgTAP test files under supabase/tests/ that reference a given table. Returns file paths. Use to verify RLS coverage exists when a migration changes policies. Empty result = coverage gap = Critical finding.",
    input_schema: {
      type: "object",
      properties: { table: { type: "string", description: "Table name to search for" } },
      required: ["table"],
    },
  },
  {
    name: "find_phi_sinks",
    description:
      "Grep the diff (or specific files) for PHI leakage risks: posthog.identify/capture with non-UUID args, console.log of user-shaped objects, Sentry.captureException with PHI, supabaseAdmin used outside server/ or app/api/. Returns matching lines with file:line. Run this whenever the diff touches analytics, logging, error reporting, or any file matching `*router*`, `*Repository*`, `*Form*`.",
    input_schema: {
      type: "object",
      properties: {
        files: {
          type: "array",
          items: { type: "string" },
          description: "Optional list of file paths to scope the grep to. Empty = grep entire diff.",
        },
      },
    },
  },
  {
    name: "get_related_backlog",
    description:
      "Search BACKLOG.md for a TD-/A11Y-/UX-/ON- ID extracted from the PR title. Returns matching rows or 'no match'. Lets the reviewer cross-check that the PR is doing what its backlog row says it should do (scope discipline).",
    input_schema: {
      type: "object",
      properties: { story_id: { type: "string", description: "Story ID like 'TD-85' or 'A11Y-012'" } },
      required: ["story_id"],
    },
  },
];

// ---------- Tool implementations ----------

const handlers = {
  get_pr_diff: ({ pr_number }) => {
    const diff = sh("gh", ["pr", "diff", String(pr_number)]);
    if (diff.startsWith("__ERROR__")) return diff;
    if (diff.length > MAX_DIFF_BYTES) {
      return diff.slice(0, MAX_DIFF_BYTES) + `\n\n[... truncated at ${MAX_DIFF_BYTES} bytes ...]`;
    }
    return diff;
  },

  get_rls_policies: ({ table }) => {
    const sql = `SELECT polname, polcmd, pg_get_expr(polqual, polrelid) AS using_expr, pg_get_expr(polwithcheck, polrelid) AS check_expr FROM pg_policy WHERE polrelid = '${table}'::regclass;`;
    const out = sh("psql", [
      "postgresql://postgres:postgres@127.0.0.1:54322/postgres",
      "-c",
      sql,
    ]);
    return out;
  },

  get_pgtap_coverage: ({ table }) => {
    const out = sh("grep", ["-rln", "--include=*.sql", table, "supabase/tests/"], { cwd: REPO_ROOT });
    if (!out.trim() || out.startsWith("__ERROR__")) return `No pgTAP files reference '${table}'.`;
    return out.trim();
  },

  find_phi_sinks: ({ files = [] }) => {
    const patterns = [
      "posthog\\.\\(identify\\|capture\\)",
      "supabaseAdmin",
      "console\\.log.*\\(email\\|name\\|phone\\|dob\\|address\\)",
      "Sentry\\.captureException",
    ];
    const targets = files.length > 0 ? files : ["apps/web/app", "apps/web/server", "apps/web/lib"];
    const results = [];
    for (const pattern of patterns) {
      const out = sh(
        "grep",
        ["-rn", "--include=*.ts", "--include=*.tsx", "-E", pattern, ...targets],
        { cwd: REPO_ROOT },
      );
      if (out.trim() && !out.startsWith("__ERROR__")) {
        results.push(`# pattern: ${pattern}\n${out.trim()}`);
      }
    }
    return results.length > 0 ? results.join("\n\n") : "No PHI sinks matched.";
  },

  get_related_backlog: ({ story_id }) => {
    const path = join(REPO_ROOT, "BACKLOG.md");
    if (!existsSync(path)) return "BACKLOG.md not found.";
    const lines = readFileSync(path, "utf8").split("\n");
    const matches = lines.filter((l) => l.includes(story_id));
    return matches.length ? matches.join("\n") : `No match for ${story_id} in BACKLOG.md`;
  },
};

const dispatch = (name, input) => {
  const handler = handlers[name];
  if (!handler) return JSON.stringify({ error: `unknown tool: ${name}` });
  try {
    const result = handler(input);
    return typeof result === "string" ? result : JSON.stringify(result, null, 2);
  } catch (err) {
    return JSON.stringify({ error: err.message });
  }
};

// ---------- Agent loop ----------

const SYSTEM_PROMPT = `You are an adversarial security reviewer for the Carelog repo (Next.js + Supabase, family caregiving, PHI-heavy).

Hard invariants — any violation is Critical:
- posthog.identify/capture must use anonymous UUID only (no email/name/phone/PHI)
- supabaseAdmin must only appear under server/ or app/api/
- Every PHI table change must have matching pgTAP RLS coverage
- RLS policies must filter by org_id or recipient_id (never global SELECT)

Workflow:
1. Call get_pr_diff first.
2. From the diff, decide: what tables changed? what analytics/logging files changed? what's the backlog story ID?
3. For each PHI table touched: fetch RLS policies AND pgTAP coverage.
4. For analytics/logging touches: run find_phi_sinks scoped to those files.
5. Cross-check the backlog row to flag scope creep.
6. Synthesize a final report. STOP calling tools when you have enough evidence.

Output format (markdown):
# PR <num> Review

**Verdict:** APPROVE | REQUEST CHANGES | BLOCK

## Critical
- [file:line] <issue> — <suggested fix>

## Medium
- ...

## Low
- ...

## Scope check
- Backlog row: <id> — <does diff match the row's scope? yes/scope-creep/missing-row>

## Tools used
- N calls: <list>

If no findings at a severity level, write "(none)".`;

const main = async () => {
  const prNum = process.argv[2];
  if (!prNum || !/^\d+$/.test(prNum)) {
    console.error("Usage: pr-review-agent.mjs <pr-number>");
    process.exit(1);
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error("ANTHROPIC_API_KEY not set.");
    process.exit(1);
  }

  const client = new Anthropic();
  const messages = [
    {
      role: "user",
      content: `Review PR #${prNum} for security, RLS, PHI, and scope issues. Start with get_pr_diff.`,
    },
  ];
  const toolCalls = [];

  for (let turn = 0; turn < MAX_TURNS; turn++) {
    const resp = await client.messages.create({
      model: MODEL,
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      tools,
      messages,
    });

    if (resp.stop_reason === "end_turn") {
      const text = resp.content.find((b) => b.type === "text")?.text ?? "(no text returned)";
      console.log(text);
      console.error(`\n[agent: ${toolCalls.length} tool calls across ${turn + 1} turns]`);
      return;
    }

    if (resp.stop_reason !== "tool_use") {
      console.error(`Unexpected stop reason: ${resp.stop_reason}`);
      process.exit(2);
    }

    messages.push({ role: "assistant", content: resp.content });
    const toolResults = [];
    for (const block of resp.content) {
      if (block.type !== "tool_use") continue;
      console.error(`-> ${block.name}(${JSON.stringify(block.input)})`);
      toolCalls.push({ name: block.name, input: block.input });
      toolResults.push({
        type: "tool_result",
        tool_use_id: block.id,
        content: dispatch(block.name, block.input),
      });
    }
    messages.push({ role: "user", content: toolResults });
  }

  console.error(`Hit MAX_TURNS=${MAX_TURNS} without completing.`);
  process.exit(3);
};

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
