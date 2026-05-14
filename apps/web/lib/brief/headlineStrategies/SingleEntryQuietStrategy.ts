import type {
  HeadlineStrategy,
  ClassifiedHeadline,
  HeadlineInput,
} from "./types";

/**
 * Strategy 6: Single entry, non-difficult mood (good/okay/null/unknown).
 */
export class SingleEntryQuietStrategy implements HeadlineStrategy {
  classify(input: HeadlineInput): ClassifiedHeadline | null {
    if (input.entries.length !== 1) return null;
    const mood = input.entries[0]?.mood;
    if (mood === "difficult") return null;
    const name = firstName(input.recipientName);
    return {
      state: "single_entry",
      headline: [
        { text: `One note logged for ${name}. ` },
        { text: "Quiet", em: true },
        { text: " since." },
      ],
    };
  }
}

function firstName(full: string): string {
  return full.trim().split(/\s+/)[0] ?? full;
}
