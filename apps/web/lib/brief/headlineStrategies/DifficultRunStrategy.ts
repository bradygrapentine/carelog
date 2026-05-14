import type {
  HeadlineStrategy,
  ClassifiedHeadline,
  HeadlineInput,
} from "./types";

/**
 * Strategy 4: Difficult run — multiple difficult-mood entries, no flag/crisis.
 */
export class DifficultRunStrategy implements HeadlineStrategy {
  classify(input: HeadlineInput): ClassifiedHeadline | null {
    const difficultCount = input.entries.filter(
      (e) => e.mood === "difficult",
    ).length;
    if (difficultCount < 2) return null;
    const name = firstName(input.recipientName);
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
}

function firstName(full: string): string {
  return full.trim().split(/\s+/)[0] ?? full;
}
