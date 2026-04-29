import { type Headline, parseStoredHeadline } from "@/lib/brief/headline";

type BriefHeadlineProps = {
  /**
   * Stored headline as raw jsonb (Span[]) or null for legacy briefs.
   * Pass `brief.headline` directly — this component validates and
   * falls back to `fallback` on invalid / missing data.
   *
   * Spans with `em: true` become `<em>`. The scoped CSS rule
   * `.headline-display em { font-style: italic; font-weight: 300;
   * color: var(--color-primary) }` (globals.css) is what gives them
   * the Lamplight Violet italic. The parent must therefore carry
   * `.headline-display` somewhere in the ancestry — both BriefHero's
   * BriefShell and BriefEditorial's `<h1>` already do.
   */
  headline: unknown;
  /** Plain-text fallback (the existing `care_briefs.title`). */
  fallback: string;
};

/**
 * Renders the structured editorial headline as a fragment of `<span>`
 * and `<em>` nodes. Intentionally returns a fragment, not a heading
 * element, so the caller controls h1 / h2 / wrapper choice. Per
 * DESIGN.md, BriefHero uses h2 (dashboard) and BriefEditorial uses
 * h1 (share route).
 */
export function BriefHeadline({ headline, fallback }: BriefHeadlineProps) {
  const parsed: Headline | null = parseStoredHeadline(headline);
  if (!parsed) return <>{fallback}</>;
  return (
    <>
      {parsed.map((span, i) =>
        span.em ? (
          <em key={i}>{span.text}</em>
        ) : (
          <span key={i}>{span.text}</span>
        ),
      )}
    </>
  );
}
