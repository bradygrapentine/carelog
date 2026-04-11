---
name: ollama
description: Dispatch parallel tasks to local Ollama models. Opus/Sonnet stays as orchestrator; local models handle sub-tasks via Ollama's Anthropic-compatible API.
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

## Quick-start check

Before dispatching, verify Ollama is reachable:
```bash
node -e "fetch('http://localhost:11434/api/tags').then(r=>r.json()).then(d=>console.log(d.models?.map(m=>m.name)))"
```
