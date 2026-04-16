# AI Assistant — Design Spec

**Date:** 2026-04-15
**Status:** Draft — awaiting implementation plan
**Scope:** Web app (Next.js). Mobile parity deferred to v2.

---

## Overview

An in-app AI assistant that helps caregivers stay on top of care data, draft communications, and execute a limited set of low-risk actions — all via natural language. Powered by the Claude API with a hybrid PHI-handling approach: structured data is de-identified server-side before any API call; free-text is never included unless the user explicitly pastes it.

---

## Entry Point

**Floating Action Button (FAB)** — `✦` icon, bottom-right corner, rendered in the root layout on every authenticated page. Persistent across all routes. A subtle pulse animation plays on first visit to draw attention.

On tap:
- If consent not yet given → opens `AIConsentModal`
- If consent given → opens `AIPanel`

---

## UX Model: Context-Aware

The panel opens with 2–3 suggestions relevant to the current page, plus a set of always-available global prompts, plus a freeform text input.

### Page → suggestions mapping

| Page | Contextual suggestions |
|---|---|
| Dashboard | Summarize last 48h updates · Flag anything urgent |
| Medications | Check today's adherence · Flag missed doses this week |
| Schedule | Cover next week's shifts · Identify unassigned slots |
| Journal | Spot mood trends this month · Summarize recent entries |
| Messages | Draft a message to the team · Summarize unread threads |
| Team | Who's available this week? |
| Any page | Summarize last 48h · Draft a team message · What should I focus on today? |

Suggestions are rendered as tappable chips. Tapping one pre-fills the input and fires immediately.

---

## Permitted Actions

The assistant can propose and execute the following after explicit user confirmation via `AIActionCard`. All actions call existing tRPC mutations — no new mutation surface is added.

| Action | tRPC call | Confirmation required |
|---|---|---|
| Send message (group / DM / thread) | `messages.send` | Yes — shows full draft |
| Log mood / wellness entry | `moodEntries.create` | Yes — shows entry preview |
| Suggest + apply shift assignments | `shifts.suggest` + `shifts.assign` | Yes — coordinator only |
| Mark medication dose as taken/missed | `medications.logDose` | Yes — shows dose details |

### Safety invariants (non-negotiable)

- No delete or overwrite mutations are exposed to the AI layer.
- Shift assignments require `role = 'coordinator'` — enforced server-side; non-coordinators see an explanation in the chat, no action card.
- Every action renders an `AIActionCard` with Confirm / Cancel before any mutation fires.
- No silent failures — action errors surface inline in the card.

---

## PHI Handling

### Consent

First time the FAB is tapped, `AIConsentModal` is shown:

> "To answer your questions, the assistant reads your org's care data (schedules, medication logs, mood entries) and sends a de-identified summary to the Claude AI API. Names and free-text notes are never sent unless you paste them in a prompt."

User must tap **Enable AI Assistant** to proceed. Choice stored as `user_profiles.ai_assistant_enabled`. Can be revoked in Settings → Privacy → AI Assistant. Revoking deletes all `ai_conversations` rows for the user (disclosed in revoke UI).

### De-identification rules (server-side, before every API call)

- Care recipient name → `"care recipient"`
- Team member names → `"team member 1"`, `"team member 2"`, etc. (stable within a single `aiRouter.query` call — re-mapped on each request)
- Journal entry bodies → excluded
- Message text bodies → excluded
- Document content → excluded
- Structured values (medication names, doses, times, mood scores, shift slots) → included

Users may paste free-text excerpts manually into the prompt input. This is their explicit choice; the system does not include it automatically.

---

## Architecture

### Frontend components

```
RootLayout
└── AIAssistantProvider          ← open/close state, current route context
    ├── AIConsentModal            ← first-use gate (renders over everything)
    ├── AIFab                     ← persistent ✦ button
    └── AIPanel                   ← slide-up sheet
        ├── AIContextSuggestions  ← page-aware chips
        ├── AIChatThread          ← message history + streaming response
        └── AIActionCard          ← confirm/cancel before mutation
```

**Hooks:**
- `useAIContext()` — maps `usePathname()` to the suggestion set for that route
- `useAIConsent()` — reads `ai_assistant_enabled` from the current user profile

### Server data flow

1. User sends prompt → `aiRouter.query(prompt, pageContext)`
2. Server fetches relevant structured data via existing DB/tRPC, applies de-identification rules
3. Builds context blob + sends to Claude API with system prompt
4. Streams response back to client
5. If response includes a proposed action → client renders `AIActionCard`
6. On Confirm → client calls the relevant existing tRPC mutation
7. On Cancel → no-op

---

## Schema

### Migration: `user_profiles`

```sql
ALTER TABLE user_profiles
  ADD COLUMN ai_assistant_enabled boolean NOT NULL DEFAULT false;
```

### New table: `ai_conversations`

```sql
CREATE TABLE ai_conversations (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  org_id      uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  messages    jsonb[] NOT NULL DEFAULT '{}',
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- RLS: user can only read/write their own rows
ALTER TABLE ai_conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner only" ON ai_conversations
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
```

No PHI is stored in `messages` — only de-identified prompts and assistant responses.

---

## tRPC Router: `aiRouter`

| Procedure | Type | Description |
|---|---|---|
| `query` | mutation | Takes `{ prompt, pageContext }`. Fetches + de-identifies data, calls Claude API, returns streaming response. |
| `enableConsent` | mutation | Sets `ai_assistant_enabled = true` on the current user's profile. |
| `revokeConsent` | mutation | Sets `ai_assistant_enabled = false` + deletes all `ai_conversations` rows for the user. |

Actions are not routed through `aiRouter` — the client calls the existing action-specific tRPC procedures directly after the user confirms via `AIActionCard`.

---

## Error States

| Scenario | Behavior |
|---|---|
| Claude API unavailable / timeout | Inline error in chat thread. No action cards rendered. |
| Consent not given | FAB tap opens consent modal. Panel inaccessible without consent. |
| Action mutation fails | Error shown inside `AIActionCard`. User can retry or cancel. |
| Non-coordinator attempts shift action | Action card not shown. AI response explains the restriction. |
| User revokes consent | `ai_conversations` deleted. Panel blocked until re-consent. |

---

## Testing

### Vitest (unit)
- Context builder: each page → expected data shape + de-identification applied
- De-identification util: names scrubbed, free-text fields excluded
- `useAIConsent`: returns correct boolean from user profile
- Action routing: proposed action type → correct tRPC procedure called

### Playwright (E2E)
- `e2e/ai-assistant-consent.spec.ts`: FAB tap → consent modal → enable → panel opens
- `e2e/ai-assistant-revoke.spec.ts`: revoke in settings → panel blocked on next tap
- `e2e/ai-assistant-action.spec.ts`: mocked response with action → confirm → mutation fires; cancel → mutation not fired

### pgTAP
- `ai_conversations`: user reads own rows ✓
- Cross-user read blocked ✓
- Cross-org read blocked ✓
- Anon blocked ✓

---

## Out of Scope (v1)

- Mobile app (deferred to v2)
- Voice input
- Proactive / push notifications from the AI ("here's your daily summary")
- Self-hosted model option (revisit for enterprise tier)
- AI reading full document text or journal bodies (only metadata included in v1)
- Conversation history across sessions (v1 is session-only; `ai_conversations` table scaffolded for future persistence)
