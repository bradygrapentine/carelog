import type { ClassifiedHeadline, HeadlineInput } from "../headline";

export type { ClassifiedHeadline, HeadlineInput };

export interface HeadlineStrategy {
  classify(input: HeadlineInput): ClassifiedHeadline | null;
}
