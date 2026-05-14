import type {
  HeadlineStrategy,
  ClassifiedHeadline,
  HeadlineInput,
} from "./types";

/**
 * Strategy 1: Empty — no entries since the previous brief.
 */
export class EmptyStrategy implements HeadlineStrategy {
  classify(input: HeadlineInput): ClassifiedHeadline | null {
    if (input.entries.length !== 0) return null;
    const name = firstName(input.recipientName);
    return {
      state: "empty",
      headline: [
        { text: "No notes for " },
        { text: name, em: true },
        { text: " yet. Start with whatever happened today." },
      ],
    };
  }
}

function firstName(full: string): string {
  return full.trim().split(/\s+/)[0] ?? full;
}
