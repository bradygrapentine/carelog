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
 * Adding a state: append to BRIEF_STATES, add a classifier branch,
 * add 1-3 templates. Keep template strings ≤10 words. Each `em`
 * span carries the *state* of the moment, never the subject.
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

function firstName(full: string): string {
  return full.trim().split(/\s+/)[0] ?? full;
}

function countMood(entries: HeadlineEntry[], mood: Mood): number {
  return entries.filter((e) => e.mood === mood).length;
}

function pluralize(n: number, one: string, many: string): string {
  return n === 1 ? one : many;
}

/**
 * Classify a brief snapshot into a named state. The first matching
 * branch wins; order is severity-descending (empty/crisis/flagged
 * before steady/default). Pure function — no I/O, easy to test.
 */
export function classifyBrief(input: HeadlineInput): ClassifiedHeadline {
  const { entries } = input;
  const name = firstName(input.recipientName);

  // 1. Empty — no entries since the previous brief.
  if (entries.length === 0) {
    return {
      state: "empty",
      headline: [
        { text: "No notes for " },
        { text: name, em: true },
        { text: " yet. Start with whatever happened today." },
      ],
    };
  }

  // 2. Crisis — any crisis-mood entry. Highest severity, always wins.
  const crisisCount = countMood(entries, "crisis");
  if (crisisCount > 0) {
    if (crisisCount === 1) {
      return {
        state: "crisis",
        headline: [
          { text: `${name} had a ` },
          { text: "crisis moment", em: true },
          { text: ". One note flagged for the team." },
        ],
      };
    }
    return {
      state: "crisis",
      headline: [
        { text: `${name} had a ` },
        { text: "hard stretch", em: true },
        { text: `. ${crisisCount} flagged notes.` },
      ],
    };
  }

  // 3. Flagged-but-not-crisis — caregiver marked notes for the doctor.
  const flaggedCount = entries.filter((e) => e.flagged).length;
  if (flaggedCount > 0) {
    return {
      state: "flagged",
      headline: [
        { text: `${flaggedCount} ` },
        { text: pluralize(flaggedCount, "note", "notes"), em: true },
        { text: ` from ${name} worth a ` },
        { text: "second look", em: true },
        { text: "." },
      ],
    };
  }

  // 4. Difficult run — multiple difficult-mood entries, no flag/crisis.
  const difficultCount = countMood(entries, "difficult");
  if (difficultCount >= 2) {
    return {
      state: "difficult_run",
      headline: [
        { text: `${name} has had a ` },
        { text: "rough", em: true },
        { text: ` stretch. ${difficultCount} ` },
        { text: "difficult", em: true },
        { text: " days." },
      ],
    };
  }

  // 5. Single entry — exactly one note since the last brief.
  if (entries.length === 1) {
    const mood = entries[0]?.mood;
    if (mood === "difficult") {
      return {
        state: "single_entry",
        headline: [
          { text: `${name} had a ` },
          { text: "difficult", em: true },
          { text: " day. One note on file." },
        ],
      };
    }
    return {
      state: "single_entry",
      headline: [
        { text: `One note logged for ${name}. ` },
        { text: "Quiet", em: true },
        { text: " since." },
      ],
    };
  }

  // 6. Quiet/stable — multiple entries, all good/okay, no flag/crisis.
  const goodOrOkay = entries.every(
    (e) => e.mood === "good" || e.mood === "okay" || !e.mood,
  );
  if (goodOrOkay) {
    return {
      state: "quiet_stable",
      headline: [
        { text: "A " },
        { text: "steady", em: true },
        { text: ` stretch for ${name}. ${entries.length} ` },
        { text: pluralize(entries.length, "note", "notes"), em: true },
        { text: "." },
      ],
    };
  }

  // 7. Default — entries exist but don't match any sharper category.
  return {
    state: "default",
    headline: [
      { text: `Latest from ${name}'s ` },
      { text: "care team", em: true },
      { text: "." },
    ],
  };
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
