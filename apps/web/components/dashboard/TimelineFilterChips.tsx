"use client";

export type ChipOption = {
  id: string;
  label: string;
};

type TimelineFilterChipsProps = {
  options: ChipOption[];
  selected: string[];
  onChange: (next: string[]) => void;
  className?: string;
};

export function TimelineFilterChips({
  options,
  selected,
  onChange,
  className,
}: TimelineFilterChipsProps) {
  function handleToggle(id: string) {
    if (selected.includes(id)) {
      onChange(selected.filter((s) => s !== id));
    } else {
      onChange([...selected, id]);
    }
  }

  return (
    <fieldset
      className={`border-0 p-0 m-0 ${className ?? ""}`}
    >
      <legend className="sr-only">Filter timeline by event type</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => {
          const isSelected = selected.includes(option.id);
          return (
            <button
              key={option.id}
              type="button"
              role="switch"
              aria-pressed={isSelected}
              onClick={() => handleToggle(option.id)}
              className={[
                "rounded-full border px-3 py-1 text-sm font-medium transition-colors",
                "focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:ring-offset-2",
                isSelected
                  ? "border-[var(--color-primary)] bg-[var(--color-primary-subtle)] text-[var(--color-primary)]"
                  : "border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-muted)]",
              ].join(" ")}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
