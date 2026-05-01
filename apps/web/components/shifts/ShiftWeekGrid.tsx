"use client";

/**
 * UX-083 — Shift Week Grid.
 *
 * Pure presentational. Mon–Sun columns, configurable hour rows.
 * Caller passes pre-resolved ShiftBlock[] with caregiver names and colors.
 * No tRPC calls inside.
 */

export type ShiftBlock = {
  id: string;
  caregiverId: string;
  /** Pre-resolved display name. */
  caregiverName: string;
  /** CSS color or token reference. Defaults to rotation of design tokens. */
  caregiverColor?: string;
  /** Day of week: 0=Mon, 6=Sun. */
  day: 0 | 1 | 2 | 3 | 4 | 5 | 6;
  /** Inclusive start hour (0–23). */
  startHour: number;
  /** Exclusive end hour (1–24). */
  endHour: number;
};

export type ShiftWeekGridProps = {
  blocks: ShiftBlock[];
  /** First hour to show (default 6). */
  startHour?: number;
  /** Last hour to show, exclusive (default 22). */
  endHour?: number;
  /** Day column labels (default Mon..Sun). */
  dayLabels?: string[];
  className?: string;
};

const DEFAULT_START = 6;
const DEFAULT_END = 22;
const DEFAULT_DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/** Rotating token palette for blocks without explicit caregiverColor. */
const COLOR_ROTATION = [
  "var(--color-primary-subtle)",
  "var(--color-secondary-subtle)",
  "var(--color-tertiary-subtle)",
];

function deriveColor(caregiverId: string, index: number): string {
  // Use the block index for deterministic rotation
  return COLOR_ROTATION[index % COLOR_ROTATION.length];
}

export function ShiftWeekGrid({
  blocks,
  startHour = DEFAULT_START,
  endHour = DEFAULT_END,
  dayLabels = DEFAULT_DAY_LABELS,
  className,
}: ShiftWeekGridProps) {
  const totalRows = endHour - startHour;
  const hours = Array.from({ length: totalRows }, (_, i) => startHour + i);

  if (blocks.length === 0) {
    return (
      <div
        className={[
          "rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6",
          className,
        ]
          .filter(Boolean)
          .join(" ")}
      >
        <p className="text-sm text-[var(--color-muted)]">
          No shifts scheduled this week.
        </p>
      </div>
    );
  }

  // Clamp block rows to the visible range
  function blockGridRow(b: ShiftBlock) {
    const clampedStart = Math.max(b.startHour, startHour);
    const clampedEnd = Math.min(b.endHour, endHour);
    const rowStart = clampedStart - startHour + 2; // +2 because row 1 = header
    const rowSpan = Math.max(1, clampedEnd - clampedStart);
    return { rowStart, rowSpan };
  }

  return (
    <div
      role="grid"
      aria-label="Shift week grid"
      className={[
        "overflow-x-auto rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: `3rem repeat(${dayLabels.length}, minmax(5rem, 1fr))`,
          gridTemplateRows: `2rem repeat(${totalRows}, 2.5rem)`,
          minWidth: `calc(3rem + ${dayLabels.length} * 5rem)`,
        }}
      >
        {/* Corner cell */}
        <div
          role="columnheader"
          aria-label="Hour"
          className="border-b border-r border-[var(--color-border)] bg-[var(--color-primary-subtle)]"
        />

        {/* Day header cells */}
        {dayLabels.map((label, colIdx) => (
          <div
            key={label}
            role="columnheader"
            className="flex items-center justify-center border-b border-r border-[var(--color-border)] bg-[var(--color-primary-subtle)] text-xs font-semibold text-[var(--color-ink)] last:border-r-0"
            style={{ gridColumn: colIdx + 2, gridRow: 1 }}
          >
            {label}
          </div>
        ))}

        {/* Hour label cells + empty grid cells */}
        {hours.map((hour, rowIdx) => (
          <>
            {/* Hour label */}
            <div
              key={`hour-${hour}`}
              role="rowheader"
              className="flex items-start justify-end pr-2 pt-1 border-b border-r border-[var(--color-border)] font-mono text-[10px] text-[var(--color-muted)] uppercase"
              style={{ gridColumn: 1, gridRow: rowIdx + 2 }}
            >
              {hour}:00
            </div>

            {/* Empty cells for each day column */}
            {dayLabels.map((_, colIdx) => (
              <div
                key={`cell-${hour}-${colIdx}`}
                role="gridcell"
                aria-label={`${dayLabels[colIdx]} ${hour}:00`}
                className="border-b border-r border-[var(--color-border)] last:border-r-0"
                style={{ gridColumn: colIdx + 2, gridRow: rowIdx + 2 }}
              />
            ))}
          </>
        ))}

        {/* Shift blocks */}
        {blocks.map((block, idx) => {
          const { rowStart, rowSpan } = blockGridRow(block);
          const color = block.caregiverColor ?? deriveColor(block.caregiverId, idx);
          const dayLabel = dayLabels[block.day] ?? String(block.day);
          const ariaLabel = `${block.caregiverName}, ${dayLabel} ${block.startHour}:00 to ${block.endHour}:00`;

          return (
            <div
              key={block.id}
              role="gridcell"
              aria-label={ariaLabel}
              style={{
                gridColumn: block.day + 2,
                gridRow: `${rowStart} / span ${rowSpan}`,
                backgroundColor: color,
                zIndex: 1,
              }}
              className="m-0.5 rounded flex items-center justify-center text-xs font-medium text-[var(--color-ink)] overflow-hidden"
            >
              <span className="truncate px-1">{block.caregiverName}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
