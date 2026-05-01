type FridayExportHintProps = {
  therapistEmail?: string;
  className?: string;
};

export function FridayExportHint({
  therapistEmail,
  className,
}: FridayExportHintProps) {
  return (
    <section
      className={[
        "rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-muted)] p-4",
        className ?? "",
      ]
        .join(" ")
        .trim()}
      aria-label="Friday therapist export"
    >
      <p className="eyebrow-mono mb-2">Friday · Therapist export</p>
      <p className="text-sm font-semibold text-[var(--text-primary)] mb-1">
        Your week, sent every Friday.
      </p>
      <p className="text-sm text-[var(--text-secondary)]">
        Carelog compiles your journal into a Friday email
        {therapistEmail ? ` to ${therapistEmail}` : ""}. You can opt out
        anytime.
      </p>
    </section>
  );
}
