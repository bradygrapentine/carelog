---
name: ollama
description: Primary dispatch backend for parallel, mechanical, and exploratory subtasks. Routes work to local/cloud Ollama models via the Anthropic-compatible API; Claude Code stays as the orchestrator. Use for 3+ independent tasks, bulk boilerplate, file enumeration, red/blue/verifier loops, or anything where correctness is cheap to verify afterward.
---

# Ollama Local Agents

Use this skill to farm independent sub-tasks out to fast, cheap local models while keeping Opus/Sonnet as the orchestrator.

## When to use

- Code exploration (file search, pattern matching, reading multiple files)
- Drafting boilerplate to a known pattern (tests, migration stubs, component shells)
- Summarizing / extracting from large files
- Any task where correctness can be verified by the orchestrator afterward

**Do not use for:** RLS/security decisions, architecture choices, anything requiring project-wide context.

---

## Models

| Model | Best for | Requires |
|-------|----------|---------|
| `qwen3-coder` | Code tasks, default | Local pull |
| `glm-4.7-flash` | General reasoning, fast | Local pull (~23GB VRAM) |
| `glm-4.7:cloud` | General, full context | Ollama account |
| `minimax-m2.5:cloud` | Natively spawns subagents | Ollama account |
| `qwen3-coder:480b-cloud` | Large code tasks | Ollama account |

Override with `OLLAMA_MODEL=<model>` env var or pass model name in the task list.

---

## Instructions

### Step 1 — Identify tasks

List the independent sub-tasks. Each must be self-contained: include all context in the prompt (file contents, function signatures, expected output format). Local models have no access to the codebase.

### Step 2 — Write and run the dispatch script

Write the following script to `/tmp/ollama-agents-<timestamp>.mjs` then run it with Bash:

```js
// /tmp/ollama-agents-TIMESTAMP.mjs
const BASE_URL = process.env.OLLAMA_BASE_URL ?? 'http://localhost:11434';
const MODEL    = process.env.OLLAMA_MODEL    ?? 'qwen3-coder';
const TIMEOUT  = 120_000; // ms per task

const tasks = [
  {
    id: 'task-1',
    model: MODEL, // override per-task if needed
    prompt: `<full self-contained prompt for task 1>`,
  },
  {
    id: 'task-2',
    model: MODEL,
    prompt: `<full self-contained prompt for task 2>`,
  },
  // add more tasks...
];

async function runTask({ id, model, prompt }) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT);
  try {
    const res = await fetch(`${BASE_URL}/v1/messages`, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': 'ollama',
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        max_tokens: 4096,
        messages: [{ role: 'user', content: prompt }],
      }),
    });
    if (!res.ok) {
      const err = await res.text();
      return { id, ok: false, error: `HTTP ${res.status}: ${err}` };
    }
    const data = await res.json();
    const text = data.content?.find(b => b.type === 'text')?.text ?? JSON.stringify(data);
    return { id, ok: true, result: text };
  } catch (e) {
    return { id, ok: false, error: e.message };
  } finally {
    clearTimeout(timer);
  }
}

const results = await Promise.all(tasks.map(runTask));
console.log(JSON.stringify(results, null, 2));
```

Run with:
```bash
node /tmp/ollama-agents-TIMESTAMP.mjs
```

### Step 3 — Verify Ollama is running

If tasks fail with connection errors, run:
```bash
ollama list          # shows pulled models
ollama serve         # start if not running (usually auto-starts)
ollama pull qwen3-coder   # pull default model if missing
```

Or use a cloud model (no local GPU required):
```bash
ollama pull glm-4.7:cloud
```

### Step 4 — Synthesize results

Parse the JSON output. For each task:
- `ok: true` → use `result` directly
- `ok: false` → log the error and either retry with a different model or handle yourself

Combine results and continue with the main task.

---

## Team dispatch pattern

For a multi-role agent team, assign each task a role and tailor the prompt:

```js
const tasks = [
  {
    id: 'explorer',
    model: 'qwen3-coder',
    prompt: `You are a code explorer. Given this file tree:\n${fileTree}\n\nFind all files that handle authentication and list them with a one-line description of each.`,
  },
  {
    id: 'summarizer',
    model: 'glm-4.7:cloud',
    prompt: `Summarize the following code in plain English, focusing on what it does and any potential issues:\n\n${codeSnippet}`,
  },
  {
    id: 'drafter',
    model: 'qwen3-coder',
    prompt: `Write a Vitest unit test for the following function following this pattern:\n${testPattern}\n\nFunction to test:\n${functionCode}`,
  },
];
```

---

## Preflight health check

Run before every dispatch:
```bash
curl -sf http://localhost:11434/api/tags > /dev/null && echo "ollama ok" || echo "ollama not running — start with 'ollama serve' or switch to a :cloud model"
```

If the local server is unreachable: prompt the user to start Ollama, OR automatically fall back to `glm-4.7:cloud` and notify: **"local Ollama unreachable — using glm-4.7:cloud instead"**. Never silently degrade.

## Model selection guide

| Task type | Model | Why |
|-----------|-------|-----|
| Code generation, boilerplate | `qwen3-coder` (local) | Fast, cheap, strong at known patterns |
| Multi-file exploration / synthesis | `glm-4.7:cloud` | Larger context window, better synthesis |
| Complex reasoning / planning | `minimax-m2.5:cloud` | Natively spawns subagents, best judgment |
| Bulk parallel (10+ tasks) | `qwen3-coder` (local) | Zero API cost, can fan out wide |
| Local unavailable, need code | `qwen3-coder:480b-cloud` | Cloud fallback for the default path |

## Dispatch patterns

### Parallel fan-out
10+ independent tasks (test scaffolds, component stubs, file summaries) → build a `tasks` array, `Promise.all(tasks.map(runTask))`, synthesize results. Local `qwen3-coder` keeps cost at zero.

### Red/blue/verifier loop
Use Ollama for Blue Team fix generation (cheap, parallel per finding), keep Claude Code as the Verifier (security judgment, full context). Red Team can run on Ollama when the attack surface is well-enumerated.

### Exploration + synthesis
Fan out N file reads to Ollama (per-file summary prompts), then Claude synthesizes the combined output. Keeps raw file content out of Claude's context — only the distilled summaries enter.
