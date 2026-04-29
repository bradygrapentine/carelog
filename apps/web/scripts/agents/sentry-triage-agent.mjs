#!/usr/bin/env node
// TD-86 — Sentry issue triage agent.
// Pattern: Anthropic threat-intel cookbook — agent loop with multi-source tool fan-out.
// Given a Sentry issue URL, autonomously produces a backlog-ready story draft.
// Read-only — does NOT write back to Sentry, GitHub, or BACKLOG.md. Human commits the draft.
//
// Usage:  node apps/web/scripts/agents/sentry-triage-agent.mjs <sentry-issue-url>
// Env:    ANTHROPIC_API_KEY, SENTRY_AUTH_TOKEN
// Output: structured JSON to stdout, draft BACKLOG row to stderr.

import Anthropic from "@anthropic-ai/sdk";
import { execFileSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const MODEL = "claude-sonnet-4-6";
const MAX_TURNS = 10;
const SENTRY_API = "https://sentry.io/api/0";

const REPO_ROOT = execFileSync("git", ["rev-parse", "--show-toplevel"], { encoding: "utf8" }).trim();

const sh = (cmd, args, opts = {}) => {
  try {
    return execFileSync(cmd, args, { encoding: "utf8", maxBuffer: 5_000_000, ...opts });
  } catch (err) {
    return `__ERROR__: ${err.message}\n${err.stderr || ""}`;
  }
};

const sentryFetch = async (path) => {
  const token = process.env.SENTRY_AUTH_TOKEN;
  if (!token) return { error: "SENTRY_AUTH_TOKEN not set" };
  const res = await fetch(`${SENTRY_API}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return { error: `${res.status} ${res.statusText}` };
  return res.json();
};

// Parse a Sentry issue URL into { org_slug, issue_id }
// Examples:
//   https://carelog.sentry.io/issues/CARELOG-123/
//   https://sentry.io/organizations/carelog/issues/4567890/
const parseIssueUrl = (url) => {
  let m = url.match(/^https?:\/\/([^.]+)\.sentry\.io\/issues\/([^/?#]+)/);
  if (m) return { org_slug: m[1], issue_id: m[2] };
  m = url.match(/sentry\.io\/organizations\/([^/]+)\/issues\/([^/?#]+)/);
  if (m) return { org_slug: m[1], issue_id: m[2] };
  return null;
};

// ---------- Tools ----------

const tools = [
  {
    name: "get_sentry_issue",
    description:
      "Fetch a Sentry issue by URL. Returns title, culprit, level, status, count, userCount, firstSeen, lastSeen, and metadata. Call this FIRST to identify the issue and decide which other tools to call.",
    input_schema: {
      type: "object",
      properties: { issue_url: { type: "string", description: "Full Sentry issue URL" } },
      required: ["issue_url"],
    },
  },
  {
    name: "get_recent_events",
    description:
      "Fetch the most recent N events for a Sentry issue, including stack traces and request context. Use after get_sentry_issue when you need a stack trace to identify the failing file/line.",
    input_schema: {
      type: "object",
      properties: {
        issue_id: { type: "string", description: "Sentry issue short ID (e.g. CARELOG-123) or numeric ID" },
        org_slug: { type: "string", description: "Sentry organization slug" },
        limit: { type: "integer", description: "How many events to fetch (default 1)" },
      },
      required: ["issue_id", "org_slug"],
    },
  },
  {
    name: "git_blame",
    description:
      "Run `git blame -L start,end -- file` to identify the commit that introduced a stack-trace line. Use whenever you have a file:line from a stack trace to find the responsible PR.",
    input_schema: {
      type: "object",
      properties: {
        file: { type: "string", description: "Path relative to repo root" },
        line: { type: "integer", description: "1-based line number" },
      },
      required: ["file", "line"],
    },
  },
  {
    name: "find_related_pr",
    description:
      "Search recent merged PRs that touched a given file. Returns PR number + title + merge date. Use after git_blame to surface the most recent PR(s) that may have introduced the regression.",
    input_schema: {
      type: "object",
      properties: { file: { type: "string", description: "Path relative to repo root" } },
      required: ["file"],
    },
  },
  {
    name: "find_related_backlog",
    description:
      "Grep BACKLOG.md for keywords from the issue title or culprit. Returns matching rows. Use to check whether a row already exists for this bug before drafting a new one.",
    input_schema: {
      type: "object",
      properties: { keywords: { type: "string", description: "Space-separated keywords to grep" } },
      required: ["keywords"],
    },
  },
];

// ---------- Tool implementations ----------

const handlers = {
  get_sentry_issue: async ({ issue_url }) => {
    const parsed = parseIssueUrl(issue_url);
    if (!parsed) return JSON.stringify({ error: "Could not parse Sentry URL" });
    const data = await sentryFetch(`/organizations/${parsed.org_slug}/issues/?query=${encodeURIComponent(parsed.issue_id)}&limit=1`);
    // Fallback: hit the issue directly by short-id
    if (data.error || !Array.isArray(data) || data.length === 0) {
      const direct = await sentryFetch(`/issues/${parsed.issue_id}/`);
      return JSON.stringify({ ...direct, _parsed: parsed }, null, 2);
    }
    return JSON.stringify({ ...data[0], _parsed: parsed }, null, 2);
  },

  get_recent_events: async ({ issue_id, org_slug, limit = 1 }) => {
    const data = await sentryFetch(`/issues/${issue_id}/events/?limit=${limit}`);
    if (data.error) return JSON.stringify(data);
    return JSON.stringify(Array.isArray(data) ? data.slice(0, limit) : data, null, 2);
  },

  git_blame: ({ file, line }) => {
    const span = `${line},${line}`;
    return sh("git", ["blame", "-L", span, "--", file], { cwd: REPO_ROOT });
  },

  find_related_pr: ({ file }) => {
    const out = sh(
      "gh",
      ["pr", "list", "--state", "merged", "--limit", "10", "--search", file, "--json", "number,title,mergedAt"],
      { cwd: REPO_ROOT },
    );
    return out;
  },

  find_related_backlog: ({ keywords }) => {
    const path = join(REPO_ROOT, "BACKLOG.md");
    if (!existsSync(path)) return "BACKLOG.md not found.";
    const terms = keywords.split(/\s+/).filter(Boolean).slice(0, 5);
    const lines = readFileSync(path, "utf8").split("\n");
    const matches = lines.filter((l) => terms.some((t) => l.toLowerCase().includes(t.toLowerCase())));
    return matches.length ? matches.slice(0, 20).join("\n") : `No backlog matches for: ${terms.join(" ")}`;
  },
};

const dispatch = async (name, input) => {
  const handler = handlers[name];
  if (!handler) return JSON.stringify({ error: `unknown tool: ${name}` });
  try {
    const result = await handler(input);
    return typeof result === "string" ? result : JSON.stringify(result, null, 2);
  } catch (err) {
    return JSON.stringify({ error: err.message });
  }
};

// ---------- Agent loop ----------

const SYSTEM_PROMPT = `You are a triage analyst for the Carelog repo. Given a Sentry issue, produce a backlog-ready story.

Workflow:
1. Call get_sentry_issue to identify the bug.
2. If the title alone is ambiguous, call get_recent_events for a stack trace.
3. From the stack trace, pick the most relevant in-app frame (file under apps/web/, apps/mobile/, or supabase/) and call git_blame on it.
4. Call find_related_pr on that file to find recent PRs that may have caused the regression.
5. Call find_related_backlog to check whether a row already exists.
6. Synthesize a structured JSON report.

Severity rubric:
- Critical: PHI exposure, payment failure, RLS bypass, auth bypass, data loss, prod-only outage affecting >1% of sessions
- Medium: feature broken but workaround exists, single-org impact, non-PHI errors >100/day
- Low: cosmetic, single-event noise, dev-only error

Output format (JSON only, in your final message — no markdown fences):
{
  "severity": "Critical" | "Medium" | "Low",
  "phi_risk": true | false,
  "title": "<one-line bug summary>",
  "existing_backlog_row": "<id>" | null,
  "evidence": [
    { "file": "<path>", "line": <int>, "blame_sha": "<sha>", "pr": <int|null> }
  ],
  "suggested_owner": "web" | "mobile" | "supabase" | "infra",
  "draft_row": "TD-XX | <Status emoji> <state> | **<title>** | <notes>",
  "tools_used": <int>
}`;

const main = async () => {
  const url = process.argv[2];
  if (!url || !url.includes("sentry.io")) {
    console.error("Usage: sentry-triage-agent.mjs <sentry-issue-url>");
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
      content: `Triage this Sentry issue and produce a backlog-ready story: ${url}`,
    },
  ];
  let toolCount = 0;

  for (let turn = 0; turn < MAX_TURNS; turn++) {
    const resp = await client.messages.create({
      model: MODEL,
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      tools,
      messages,
    });

    if (resp.stop_reason === "end_turn") {
      const text = resp.content.find((b) => b.type === "text")?.text ?? "(no text)";
      // Try to pull JSON out and pretty-print to stdout; raw text always to stderr.
      const match = text.match(/\{[\s\S]*\}/);
      if (match) {
        try {
          const parsed = JSON.parse(match[0]);
          console.log(JSON.stringify(parsed, null, 2));
          if (parsed.draft_row) console.error(`\n[draft BACKLOG row]\n${parsed.draft_row}`);
        } catch {
          console.log(text);
        }
      } else {
        console.log(text);
      }
      console.error(`\n[agent: ${toolCount} tool calls across ${turn + 1} turns]`);
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
      toolCount++;
      const content = await dispatch(block.name, block.input);
      toolResults.push({ type: "tool_result", tool_use_id: block.id, content });
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
