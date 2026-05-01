type ShiftQuoteNoteProps = {
  quote: string;
  by: string;
  when: string;
  className?: string;
};

export function ShiftQuoteNote({
  quote,
  by,
  when,
  className,
}: ShiftQuoteNoteProps) {
  return (
    <figure
      className={[
        "border-l-2 border-[var(--color-primary)] pl-4 py-1",
        className ?? "",
      ]
        .join(" ")
        .trim()}
    >
      <blockquote className="text-[var(--text-primary)] italic leading-relaxed">
        <p>{quote}</p>
      </blockquote>
      <figcaption className="mt-2 font-mono text-xs uppercase tracking-wide text-[var(--color-muted)]">
        {by} · {when}
      </figcaption>
    </figure>
  );
}
