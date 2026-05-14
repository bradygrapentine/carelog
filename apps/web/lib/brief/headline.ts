/**
 * Brief editorial headline classifier + templates.
 *
 * Per DESIGN.md, BriefHero and `/brief/[shareToken]` are the one app
 * surfaces where Fraunces with weight-300 violet `<em>` is sanctioned
 * (Italic-Emphasis Rule). This module classifies a brief's snapshot
 * into a named state and emits a structured `Span[]` so the renderer
 * can wrap emphasis spans in `<em>` without parsing strings.
 *
 * Voice: warm · candid · companion. Plainspoken, never sentimental.
 * No "good morning". No "another tough night for your sweet mom".
 * Two short clauses, ≤10 words, max two `em` spans per headline.
 *
 * Adding a state: append to BriefState, add a strategy in headlineStrategies/,
 * register it in STRATEGIES below (before DefaultStrategy). Keep template
 * strings ≤10 words. Each `em` span carries the *state*, never the subject.
 *
 * Future: when missed-dose tracking lands, add a `meds_missed` state.
 * When mood deltas become reliable, add `mood_drop`.
 */

export type Span = { text: string; em?: boolean };
export type Headline = Span[];

/**
 * Mood is captured as a string union on care_events.payload.mood.
 * Anything outside this set is treated as "no mood" for classification.
 */
const MOODS = ["good", "okay", "difficult", "crisis"] as const;
export type Mood = (typeof MOODS)[number];

export type HeadlineEntry = {
  occurred_at: string;
  mood?: string | null;
  flagged: boolean;
};

export type HeadlineInput = {
  recipientName: string; // full name from identity vault; we use first token
  entries: HeadlineEntry[]; // since previous brief, newest first
};

export type BriefState =
  | "empty"
  | "crisis"
  | "flagged"
  | "difficult_run"
  | "single_entry"
  | "quiet_stable"
  | "default";

export type ClassifiedHeadline = {
  state: BriefState;
  headline: Headline;
};

import { EmptyStrategy } from "./headlineStrategies/EmptyStrategy";
import { CrisisStrategy } from "./headlineStrategies/CrisisStrategy";
import { FlaggedStrategy } from "./headlineStrategies/FlaggedStrategy";
import { DifficultRunStrategy } from "./headlineStrategies/DifficultRunStrategy";
import { SingleEntryDifficultStrategy } from "./headlineStrategies/SingleEntryDifficultStrategy";
import { SingleEntryQuietStrategy } from "./headlineStrategies/SingleEntryQuietStrategy";
import { QuietStableStrategy } from "./headlineStrategies/QuietStableStrategy";
import { DefaultStrategy } from "./headlineStrategies/DefaultStrategy";
import type { HeadlineStrategy } from "./headlineStrategies/types";

// Order is severity-descending; precedence is load-bearing.
const STRATEGIES: HeadlineStrategy[] = [
  new EmptyStrategy(),
  new CrisisStrategy(),
  new FlaggedStrategy(),
  new DifficultRunStrategy(),
  new SingleEntryDifficultStrategy(),
  new SingleEntryQuietStrategy(),
  new QuietStableStrategy(),
  new DefaultStrategy(),
];

/**
 * Classify a brief snapshot into a named state. The first matching
 * strategy wins; order is severity-descending (empty/crisis/flagged
 * before steady/default). Pure function — no I/O, easy to test.
 */
export function classifyBrief(input: HeadlineInput): ClassifiedHeadline {
  for (const strategy of STRATEGIES) {
    const result = strategy.classify(input);
    if (result !== null) return result;
  }
  // Unreachable: DefaultStrategy always returns non-null.
  throw new Error("No headline strategy matched — DefaultStrategy missing?");
}

/**
 * Cast a stored jsonb headline back to a typed Span[]. Returns null
 * for legacy briefs (headline column was added 2026-04-29; rows
 * inserted before that have null). Validates the minimal shape we
 * commit to: each span must be { text: string, em?: boolean }.
 *
 * Anything else is treated as a corrupt/foreign value and returns
 * null, falling back to the plain `title` column. Defensive parsing
 * keeps a renderer crash from leaking onto the dashboard.
 */
export function parseStoredHeadline(raw: unknown): Headline | null {
  if (!Array.isArray(raw) || raw.length === 0) return null;
  const result: Headline = [];
  for (const span of raw) {
    if (
      typeof span !== "object" ||
      span === null ||
      typeof (span as { text?: unknown }).text !== "string"
    ) {
      return null;
    }
    const em = (span as { em?: unknown }).em;
    if (em !== undefined && typeof em !== "boolean") return null;
    result.push({
      text: (span as { text: string }).text,
      ...(em ? { em: true } : {}),
    });
  }
  return result;
}
