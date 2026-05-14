import type {
  HeadlineStrategy,
  ClassifiedHeadline,
  HeadlineInput,
} from "./types";

/**
 * Strategy 8: Default — entries exist but don't match any sharper category.
 * Always returns non-null; must be last in the dispatcher array.
 */
export class DefaultStrategy implements HeadlineStrategy {
  classify(input: HeadlineInput): ClassifiedHeadline | null {
    const name = firstName(input.recipientName);
    return {
      state: "default",
      headline: [
        { text: `Latest from ${name}'s ` },
        { text: "care team", em: true },
        { text: "." },
      ],
    };
  }
}

function firstName(full: string): string {
  return full.trim().split(/\s+/)[0] ?? full;
}
