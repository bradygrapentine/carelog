# TD-143 — Mood-label map dedup + reconcile `okay: "Settled"` divergence

**Date:** 2026-05-15
**Base SHA:** 0eaab61
**Source backlog:** TD-143
**PRD:** n/a
**Recommended executor:** direct single-track (~30min)

## Goal

Extract a single canonical `MOOD_LABELS: Record<Mood, string>` const into `apps/web/lib/mood.ts` (already home to the `Mood` type and class-map helpers) so the four user-facing mood labels live in one place. Path (a) from the row.

Reconcile the documented divergence: `apps/web/server/routers/moodEntries.ts:17` has `okay: "Settled"` while all five UI sites use `okay: "Okay"`. Per the row, the digest-tone variation is plausibly intentional — preserve it via an explicit per-route override with a comment, NOT a stealth divergence. If future-Brady decides the override is accidental, deleting two lines reverts.

## Non-goals

- **WeeklyMoodBars.tsx** — different concept. Uses `MoodBucket = "good" | "steady" | "difficult"` for week-digest aggregation. Not the four-state journal-entry mood. Out of scope. The TD-143 row's "6 maps" count incorrectly included this; correct in-scope count is **6 sites with the 4-mood entry shape** (5 capital-Label + 1 lowercase-aria).
- **MoodHeatmap.tsx:51-56** — its `MOOD_LABEL` is lowercase (`"good"`, `"okay"`, `"difficult"`, `"crisis"`) used for screen-reader text, NOT user-facing capitalized labels. Different content semantics. Out of scope.
- **No visual changes.** Pixel-identical to current state across the 6 in-scope sites (including the `"Settled"` digest variant where it currently fires).
- **No type changes to `Mood`** — the existing `"good" | "okay" | "difficult" | "crisis"` string-union stays as-is.
- **No DB / schema work** — pure UI/server-router refactor.

## Tracks

### Track 1 — Extract MOOD_LABELS, replace 6 call sites

**Sources backlog TD-143.**

**FILES ALLOWED** (modify/create):
- `apps/web/lib/mood.ts` (modify — add `MOOD_LABELS` const + helper `moodLabel(mood)` if useful; export both)
- `apps/web/server/routers/moodEntries.ts` (modify — import MOOD_LABELS, build the local digest map as `{ ...MOOD_LABELS, okay: "Settled" }` with explicit `// Digest tone: ...` comment)
- `apps/web/components/app/RecipientProfile.tsx` (modify — replace inline `{good:"Good",...}` map with import of MOOD_LABELS)
- `apps/web/app/(app)/journal/[recipientId]/SymptomPanel.tsx` (modify — replace `MOOD_OPTS` array literal with derivation from MOOD_LABELS: `(Object.keys(MOOD_LABELS) as Mood[]).map(value => ({ value, label: MOOD_LABELS[value] }))`. Preserve order.)
- `apps/web/app/(app)/journal/[recipientId]/JournalEntryForm.tsx` (modify — same derivation pattern)
- `apps/web/components/journal/MoodSpectrum.tsx` (modify — `ORDER` array keeps `tokenVar` field but reads `label` from MOOD_LABELS)
- `apps/web/components/journal/PromptedComposer.tsx` (modify — same derivation pattern as SymptomPanel)

**FILES OUT OF SCOPE — DO NOT TOUCH:**
- `apps/web/components/journal/WeeklyMoodBars.tsx` — different `MoodBucket` type; weekly-digest aggregation, not entry-form 4-mood
- `apps/web/components/journal/MoodHeatmap.tsx` — its `MOOD_LABEL` is lowercase aria-text, not user-facing capitalized labels
- Any test file unless an existing test depends on the inline literal shape of `MOOD_OPTS` / `ORDER` — in which case touching the test is allowed but only to adjust the reference, not to add new assertions
- `apps/web/lib/mood.ts:14-89` — the existing class-map helpers (`MOOD_DOT_CLS`, `MOOD_BADGE_CLS`, `MOOD_CHIP_CLS`, `MOOD_BORDER_CLS`, `MOOD_OUTLINE_BADGE_CLS`, `MOOD_SELECTED_CHIP_CLS`) and their accessor functions — leave alone. Only ADD `MOOD_LABELS` + `moodLabel()` near the top, after `type Mood`.
- DB schema, migrations, type-gen

**Branch:** `refactor/td-143-mood-labels-dedup` off base SHA above.

**Implementation steps:**

1. In `apps/web/lib/mood.ts`, immediately after `export type Mood = ...` (line 11), add:
   ```ts
   /**
    * Canonical mood order. This is the single source of truth for the order in
    * which mood options appear in pickers, segmented controls, and digests.
    * Using `as const satisfies` avoids casts at call sites that derive arrays
    * from this tuple.
    */
   export const MOOD_KEYS = ["good", "okay", "difficult", "crisis"] as const satisfies readonly Mood[];

   /**
    * User-facing capitalized labels for the four mood keys. Five UI surfaces
    * share these verbatim; `moodEntries.ts` overrides `okay` to "Settled" for
    * weekly-digest tone — see that file for the rationale.
    *
    * Note: `crisis` renders as "Hard" — intentional softer register for the
    * caregiver-facing UI (per the UX-050 "Crisis"→"Hard" rename). The TS key
    * `"crisis"` is kept for stable enum identity in DB rows + analytics.
    */
   export const MOOD_LABELS: Record<Mood, string> = {
     good: "Good",
     okay: "Okay",
     difficult: "Difficult",
     crisis: "Hard",
   };

   /** Convenience accessor; returns the label for a Mood. */
   export function moodLabel(mood: Mood): string {
     return MOOD_LABELS[mood];
   }
   ```

2. `apps/web/server/routers/moodEntries.ts` — the inline const is named `MOOD_LABEL` (singular), referenced at line 115 as `MOOD_LABEL[latestMood] ?? latestMood`. **Keep the name to minimize blast radius** (no rename, no second-site edit). Replace the inline 4-line object literal with a spread+override:
   ```ts
   import { MOOD_LABELS } from "@/lib/mood";

   // Digest tone: weekly digest uses "Settled" instead of "Okay" — softer
   // register matches the editorial voice of the digest copy. All other UI
   // surfaces use MOOD_LABELS verbatim. If digest copy is rewritten and
   // "Okay" reads fine, delete this override and import MOOD_LABELS directly.
   const MOOD_LABEL = { ...MOOD_LABELS, okay: "Settled" } as const;
   ```
   The line-115 call site stays byte-identical.

   **`MOOD_SCORE` at moodEntries.ts:7 (not in scope).** It's a sibling `Record<Mood, number>` ordered identically. Could be hoisted to `lib/mood.ts` too, but: (a) only used by this one router for weekly aggregation, (b) hoisting it would expand the diff and surface area without a current second consumer. Explicit exclusion to prevent the next TD-X from re-opening this file. If/when a second site needs mood scoring, hoist then.

3. `apps/web/components/app/RecipientProfile.tsx` — remove the inline object literal at lines 21-24, replace with `import { MOOD_LABELS } from "@/lib/mood";` and reference `MOOD_LABELS` at the consumer site.

4. For the array-shape sites (`SymptomPanel.tsx`, `JournalEntryForm.tsx`, `PromptedComposer.tsx`), derive the array from MOOD_KEYS using a module-scope const. **The cast is unnecessary** because MOOD_KEYS is `readonly Mood[]` satisfied:
   ```ts
   import { MOOD_KEYS, MOOD_LABELS, type Mood } from "@/lib/mood";
   const MOOD_OPTS: { value: Mood; label: string }[] = MOOD_KEYS.map(value => ({
     value,
     label: MOOD_LABELS[value],
   }));
   ```

   **Type-narrowing carve-out for SymptomPanel + JournalEntryForm (the Must-fix from cycle 1):** both files define a local widened type `MoodVal = Mood | ""` and type `MOOD_OPTS` as `{ value: MoodVal; ... }[]`. The derivation above produces `{ value: Mood; ... }[]` (no `""`) and would TS-error wherever the array element's `value` is fed back to a `MoodVal`-typed setter. Two options per file — pick (a) unless the file's call-site shows it actually needs MoodVal in the array (it doesn't: empty-string represents "no mood selected" by the parent state, not a chip option):

   - **(a) preferred:** keep `MOOD_OPTS` typed as `{ value: Mood; label: string }[]` (narrower). At the `setMood(... as MoodVal)` call site the existing cast already widens; no further change. Verify by reading the call site at SymptomPanel.tsx:208 and JournalEntryForm.tsx:161-180 — both invoke `setMood(opt.value as MoodVal)` style already, so the Mood→MoodVal widening at the call site survives.
   - **(b) only if (a) won't compile:** type the derived array as `{ value: MoodVal; label: string }[]` with the same map body (TS will accept Mood as a subtype of MoodVal).

   PromptedComposer.tsx:40 uses plain `useState("")` with no `MoodVal` widening — array stays narrow (`Mood`) without any carve-out.

   **If your read of an existing file shows a different array order**, halt and surface — the array order is user-facing UI sequence. (Verified at planning time: all four sites order `good → okay → difficult → crisis`, matching MOOD_KEYS.)

5. `MoodSpectrum.tsx:16-25` — preserve the `tokenVar` field; only read `label` from MOOD_LABELS:
   ```ts
   const ORDER: { value: Mood; label: string; tokenVar: string }[] = [
     { value: "good", label: MOOD_LABELS.good, tokenVar: "var(--color-mood-good)" },
     { value: "okay", label: MOOD_LABELS.okay, tokenVar: "var(--color-mood-okay)" },
     { value: "difficult", label: MOOD_LABELS.difficult, tokenVar: "var(--color-mood-difficult)" },
     { value: "crisis", label: MOOD_LABELS.crisis, tokenVar: "var(--color-mood-crisis)" },
   ];
   ```

6. Run `cd apps/web && npx tsc --noEmit` — clean.
7. Run `cd apps/web && npx vitest run` — full web suite green (any test that asserts `"Good"` / `"Okay"` / `"Difficult"` / `"Hard"` literals should continue to pass byte-for-byte; if one references the digest "Settled" it must also still pass).
8. Verify (`grep -rE "(good|okay|difficult|crisis):\s*[\"'](Good|Okay|Settled|Difficult|Hard)" apps/web --include="*.ts" --include="*.tsx"`) returns ONLY these production-code matches:
   - `apps/web/lib/mood.ts` — the 4 lines of the canonical `MOOD_LABELS` const
   - `apps/web/server/routers/moodEntries.ts` — one line for the `okay: "Settled"` override
   Test-file matches (e.g. `moodEntries.test.ts` asserting `"Good"`) are expected and don't count. `MOOD_SCORE` at `moodEntries.ts:7` is `Record<Mood, number>` so it won't match this grep (numbers, not labels).

**Acceptance (verifiable):**

- `cd apps/web && npx tsc --noEmit` exits 0
- `cd apps/web && npx vitest run` exits 0; all currently-passing tests stay passing (~2133 + skipped)
- The grep above returns ≤2 production-code matches (lib/mood.ts + moodEntries.ts override). Test-file matches don't count against the verification.
- `git diff origin/main -- apps/web/lib/mood.ts` shows ONLY additions (no edits to existing class-map exports)
- All 6 in-scope sites import from `@/lib/mood`
- `WeeklyMoodBars.tsx` and `MoodHeatmap.tsx` unmodified (verify via `git diff --stat`)

**Risk + mitigations:**

- **Risk:** Array-derivation insertion order differs from inline-literal order at some site → reorders the chip picker UI. **Mitigation:** Step 4 explicitly says halt-and-surface on order mismatch. Verified at planning time: all four array sites order as `good → okay → difficult → crisis` matching MOOD_LABELS insertion order.
- **Risk:** A test file asserts on object identity of the old inline `MOOD_OPTS` array (e.g. `expect(MOOD_OPTS).toBe(savedRef)`). **Mitigation:** vitest will catch; if any fails, adjust the test to use `toEqual` (structural) instead of `toBe` (referential). Out of scope for this PR to ADD test coverage; only adjust references.
- **Risk:** The digest path in `moodEntries.ts` references the inline map by a different name than I'm guessing (`MOOD_LABEL` vs `MOOD_LABELS` vs `MOOD_NAMES`). **Mitigation:** Step 2 says "Read the file first to confirm the inline-map name" — don't blindly rename.

## Merge order

Single track; ships as one PR.

## Execution gate

Run `/opus-on-opus docs/plans/2026-05-15-td-143-mood-labels-dedup.md --from-sprint` before commit. Apply must-fix findings.

## Post-merge verification

- No need for `/post-deploy-watch` — pure refactor, identical user-facing strings.

## Open questions

None — the row authored the decision (path a).
