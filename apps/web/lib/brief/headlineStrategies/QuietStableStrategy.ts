import type {
  HeadlineStrategy,
  ClassifiedHeadline,
  HeadlineInput,
} from "./types";

/**
 * Strategy 7: Quiet/stable — multiple entries, all good/okay/null, no flag/crisis.
 */
export class QuietStableStrategy implements HeadlineStrategy {
  classify(input: HeadlineInput): ClassifiedHeadline | null {
    const { entries } = input;
    const goodOrOkay = entries.every(
      (e) => e.mood === "good" || e.mood === "okay" || !e.mood,
    );
    if (!goodOrOkay) return null;
    const name = firstName(input.recipientName);
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
}

function firstName(full: string): string {
  return full.trim().split(/\s+/)[0] ?? full;
}

function pluralize(n: number, one: string, many: string): string {
  return n === 1 ? one : many;
}
