import type {
  HeadlineStrategy,
  ClassifiedHeadline,
  HeadlineInput,
} from "./types";

/**
 * Strategy 3: Flagged-but-not-crisis — caregiver marked notes for the doctor.
 */
export class FlaggedStrategy implements HeadlineStrategy {
  classify(input: HeadlineInput): ClassifiedHeadline | null {
    const flaggedCount = input.entries.filter((e) => e.flagged).length;
    if (flaggedCount === 0) return null;
    const name = firstName(input.recipientName);
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
}

function firstName(full: string): string {
  return full.trim().split(/\s+/)[0] ?? full;
}

function pluralize(n: number, one: string, many: string): string {
  return n === 1 ? one : many;
}
