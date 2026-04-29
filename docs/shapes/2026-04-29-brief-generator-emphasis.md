# Shape: Brief Generator Editorial Emphasis Pipeline

> Authored 2026-04-29 via `/impeccable shape` after the brief surface scored 24/40 in `/impeccable critique` with the load-bearing finding that the **Italic-Emphasis Rule never fires**. This doc precedes any code; `/impeccable craft` will pick up from here once the recommendation is approved.

## Problem

DESIGN.md sanctions exactly **one** editorial flourish in CareSync — Fraunces with weight-300 violet `<em>` on BriefHero and `/brief/[shareToken]`. The CSS is wired (`globals.css:124`), the typography is loaded, but no code path ever emits an `<em>` tag inside a `.headline-display`. The whole "warm, candid, companion" tone hinges on a load-bearing italic, and today every caregiver sees either the literal string `"Care brief"` (BriefHero) or `"A good morning for ${name}"` (BriefEditorial) regardless of whether mom slept poorly or three doses got missed. The brand's signature voice never fires; the dashboard reads like a SaaS template.

## Current state

- **Generator**: `apps/web/app/api/brief/route.ts:106-118`. Pure data snapshot — pulls last 10 journal entries + active meds, stores them as JSON in `care_briefs.content`. Sets `title: title ?? 'Care brief'` (line 112). **No LLM, no template engine, no headline logic anywhere.** The `title` column is essentially dead.
- **Schema**: `supabase/migrations/20260327234330_core_schema.sql:255` — `care_briefs(title text NOT NULL DEFAULT 'Care brief', content jsonb NOT NULL, includes text[], …)`. `content` is freeform jsonb with `{recipient_name, dob, generated_at, medications, recent_entries}`. No emphasis fields, no structured headline.
- **BriefHero render**: `BriefHero.tsx:213` — `const headlineText = brief.title ?? "Care brief"`, passed as a plain string into `<BriefShell headline={headlineText}>`. No HTML parsing, no `<em>` rendering path.
- **BriefEditorial render**: `BriefEditorial.tsx:51` — `morningGreeting()` hardcodes `"A good morning for ${name}"` and ignores `brief.title` entirely. The `.headline-display` class is applied at line 108 but the string never contains an `<em>`.
- **CSS**: `globals.css:116-129`. `.headline-display em { font-style: italic; font-weight: 300; color: var(--color-primary); }`. Correct, scoped, ready.
- **Strategic gap**: the data layer doesn't decide what to emphasize, the API layer doesn't write structured headlines, and the view layer renders strings, not markup. Three uncoupled holes — no single fix lands the rule.

This is **not** a "wire the renderer" job. The generator never produced emphasis structure to begin with.

## Desired end state

A caregiver opens `/dashboard` at 7:02am after a hard night. Above the fold:

> Eyebrow: TODAY'S BRIEF · AUTO-GENERATED 7:02A
> Headline: Mom slept *poorly*. Three doses *missed*.
> Emphasis: poorly, missed

Other states:

| State | Eyebrow | Headline | Emphasis |
|---|---|---|---|
| Mood drop | TODAY'S BRIEF · 7:02A | Mom is *quieter* today. Two flagged notes since *Tuesday*. | quieter, Tuesday |
| Quiet/stable | TODAY'S BRIEF · 7:02A | A *steady* night. Meds *on time*. | steady, on time |
| Empty (first day) | TODAY'S BRIEF · 7:02A | *Welcome.* Log your first note when you're ready. | Welcome. |

The emphasis carries the **state**, the rest of the sentence carries the subject. Two short clauses, max ~10 words, max two italic spans. Never sentimental ("good morning"), never clinical ("3 missed doses, severity HIGH").

## Shape options

### Option A — Structured-emphasis JSON, LLM-generated

Headline lives as a structured array on the brief: `headline: [{text:"Mom slept "}, {text:"poorly", em:true}, {text:". Three doses "}, {text:"missed", em:true}, {text:"."}]`. An Inngest job (or inline LLM call in `POST /api/brief`) sends the snapshot to Claude Haiku with a tight prompt: "two short clauses, ≤10 words, mark 1-2 spans as emphasis." Response is validated by Zod, stored in a new `headline jsonb` column. Renderer maps spans to `<span>`/`<em>`.

- **Schema**: new `headline jsonb` column on `care_briefs`; `title text` retired (kept for back-compat).
- **Effort**: M (LLM plumbing, Zod validator, prompt iteration, eval set).
- **Risk that kills it**: LLM produces sentimental ("a beautiful morning") or clinical ("Pt sleep score: 2/5") prose. Voice drift. Cost+latency on a path that runs every brief generation.
- **Why pick it**: only option that scales to the long tail of states. Can capture nuance (mood + meds + a flagged note) without exploding template count.

### Option B — Rule-based template engine, hand-crafted Fraunces sentences

A `lib/brief/headline.ts` module classifies the snapshot into one of ~12 named states (`crisis_night`, `meds_missed`, `mood_drop`, `quiet_stable`, `empty`, …) by inspecting `flagged` count, missed-dose count, mood deltas, entry count. Each state maps to 1-3 hand-written templates with `{name}` and `{count}` slots and **fixed emphasis words**: `Mom slept <em>poorly</em>. <em>Three</em> doses missed.` Stored as structured JSON same as Option A; generator just picks the template.

- **Schema**: same `headline jsonb` column; the difference is who fills it.
- **Effort**: S-M (classifier + ~30 hand-written templates + tests).
- **Risk that kills it**: combinatorial explosion when product wants nuance. Templates feel canned after a week. New states require code + deploy.
- **Why pick it**: deterministic, testable, zero LLM cost, voice 100% under designer control. Every italic word was chosen by a human. No prompt-injection surface, no PHI-to-LLM concern, no latency.

### Option C — Markdown-with-`*emphasis*`, sanitized at render

Generator (LLM or template) writes a Markdown string into `title` like `Mom slept *poorly*. Three doses *missed*.`. Renderer parses it through a tiny allowlist (only `*…*` → `<em>`, nothing else) and inserts into `.headline-display`. No schema change.

- **Schema**: zero. Reuse `title text`.
- **Effort**: S (10-line parser, snapshot tests).
- **Risk that kills it**: parsing strings is the same trap that produced XSS for two decades; even an allowlist parser invites future devs to extend it. Couples editorial structure to a string format that can't represent anything else (no link, no break, no role) without becoming a real markdown engine.
- **Why pick it**: ship-tomorrow if the only goal is "make BriefHero italicize something." Lowest schema disruption.

## Recommendation

**Option B (rule-based template engine).** Three of the four user principles point here:

- **One thing at a time** — the brief is one moment of the day; ~12 named states cover the moment. Templates make the moment feel handled, not auto-generated.
- **Calm beats clever** — an LLM headline that 1% of the time says "another tough night for your sweet mom" is worse than a fixed `A *hard* night.` every time. Determinism is calm.
- **Warm not sentimental** — voice in a template can be reviewed once and never drift. An LLM drifts every prompt revision.

The fourth principle (**recipient is a person, not a chart**) is where Option B is *weakest* — templates can feel mechanical. The mitigation: design the state classifier to fail toward fewer-but-truer headlines (`A steady night.` is fine; inventing a third clause is not). Option A becomes attractive *later*, after we have 3 months of which states fired and which felt off — at that point an LLM has a real eval set. Shipping LLM first means tuning a prompt against zero data.

The schema move (a structured `headline jsonb` column instead of parsing markdown out of `title`) is non-negotiable regardless of A vs B. It's the seam that lets us swap engines later without a migration.

## Open questions

1. **Who owns the template copy?** Designer-authored in a `.ts` file vs. coordinator-editable in the DB (some orgs may want their own voice). First slice: hardcoded; revisit only if a paying org asks.
2. **What's the state classifier's input window?** Last 24h? Last shift? Since last brief? `recent_entries` is currently last 30 days top-10 — that's wrong for a *today* brief.
3. **Does BriefEditorial (`/brief/[shareToken]`) use the same headline as BriefHero, or a longer editorial variant?** DESIGN.md implies same italic rule applies to both. Today they're disconnected (`morningGreeting()` ignores `title`). Recommend: same `headline` JSON, same render component.
4. **Empty/first-day state — what triggers it?** Zero `recent_entries`? Zero entries AND recipient created <48h ago? Affects both copy and the missing-data UX.
5. **What happens when a coordinator regenerates a brief 3 hours later?** New row, new headline, or update-in-place? Today it's insert-only. If 7:02a says `*hard* night` and 10:00a says `*steady* morning`, which one does the share link show?

## Out of scope

- LLM tone evaluation harness (Option A's prerequisite — defer until B is shipped and we know which states underperform).
- Coordinator-editable templates / per-org voice.
- Multilingual headlines (en-US only for now; Fraunces' Latin-only glyph set forces this anyway).
- Body-copy emphasis. Italic rule applies to the headline only; body paragraphs in BriefEditorial stay in default sans, no `<em>` rendering.
- Animation/motion on the emphasis spans (DESIGN.md explicitly forbids cleverness here).
- Retiring the `title text` column. Keep it for back-compat; new generator writes both `title` (plain-text fallback for emails/print) and `headline` (structured).
