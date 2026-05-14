import type {
  HeadlineStrategy,
  ClassifiedHeadline,
  HeadlineInput,
} from "./types";

/**
 * Strategy 5: Single entry with difficult mood.
 */
export class SingleEntryDifficultStrategy implements HeadlineStrategy {
  classify(input: HeadlineInput): ClassifiedHeadline | null {
    if (input.entries.length !== 1) return null;
    const mood = input.entries[0]?.mood;
    if (mood !== "difficult") return null;
    const name = firstName(input.recipientName);
    return {
      state: "single_entry",
      headline: [
        { text: `${name} had a ` },
        { text: "difficult", em: true },
        { text: " day. One note on file." },
      ],
    };
  }
}

function firstName(full: string): string {
  return full.trim().split(/\s+/)[0] ?? full;
}
