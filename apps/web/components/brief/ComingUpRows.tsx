type ComingUpEvent = {
  id: string;
  time: string;
  label: string;
  detail?: string;
};

type ComingUpRowsProps = {
  events: ComingUpEvent[];
  className?: string;
  emptyLabel?: string;
};

export function ComingUpRows({
  events,
  className,
  emptyLabel = "Nothing scheduled.",
}: ComingUpRowsProps) {
  if (events.length === 0) {
    return (
      <p
        className={["text-sm text-[var(--color-muted)]", className ?? ""]
          .join(" ")
          .trim()}
      >
        {emptyLabel}
      </p>
    );
  }

  return (
    <ul
      className={["divide-y divide-[var(--color-border)]", className ?? ""]
        .join(" ")
        .trim()}
    >
      {events.map((event) => (
        <li key={event.id} className="flex items-baseline gap-4 py-2.5">
          <span className="font-mono text-xs uppercase tracking-wide text-[var(--color-muted)] w-16 shrink-0">
            {event.time}
          </span>
          <span className="flex-1 min-w-0">
            <span className="text-sm text-[var(--text-primary)]">
              {event.label}
            </span>
            {event.detail && (
              <span className="ml-2 text-xs text-[var(--color-muted)]">
                {event.detail}
              </span>
            )}
          </span>
        </li>
      ))}
    </ul>
  );
}
