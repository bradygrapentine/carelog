import type {
  HeadlineStrategy,
  ClassifiedHeadline,
  HeadlineInput,
} from "./types";

/**
 * Strategy 2: Crisis — any crisis-mood entry. Highest severity, always wins.
 * Handles both singular (1 crisis) and plural (2+ crises) templates internally.
 */
export class CrisisStrategy implements HeadlineStrategy {
  classify(input: HeadlineInput): ClassifiedHeadline | null {
    const crisisCount = input.entries.filter((e) => e.mood === "crisis").length;
    if (crisisCount === 0) return null;
    const name = firstName(input.recipientName);
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
}

function firstName(full: string): string {
  return full.trim().split(/\s+/)[0] ?? full;
}
