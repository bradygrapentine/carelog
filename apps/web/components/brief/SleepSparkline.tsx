"use client";

import { cn } from "@/lib/utils";

type SleepNight = {
  date: string; // ISO date for that night
  hours: number; // total sleep hours
  wakes: number; // count of nighttime wake-ups (>= 0)
};

type SleepSparklineProps = {
  nights: SleepNight[]; // exactly 7 nights, oldest first
  className?: string;
};

const W = 280;
const H = 48;
const PAD = 6;

function computePoints(
  nights: SleepNight[],
): { x: number; y: number }[] {
  const values = nights.map((n) => n.hours);
  const max = Math.max(...values);
  const min = Math.min(...values);
  const range = max - min;

  return values.map((v, i) => {
    const x = (i / (values.length - 1)) * (W - PAD * 2) + PAD;
    // If all values are the same (range === 0), render flat at midline
    const y =
      range === 0
        ? H / 2
        : H - PAD - ((v - min) / range) * (H - PAD * 2);
    return { x, y };
  });
}

export function SleepSparkline({ nights, className }: SleepSparklineProps) {
  if (nights.length !== 7) {
    console.warn(
      `SleepSparkline: expected exactly 7 nights, got ${nights.length}`,
    );
    return null;
  }

  const avgHours = +(
    nights.reduce((sum, n) => sum + n.hours, 0) / nights.length
  ).toFixed(1);
  const totalWakes = nights.reduce((sum, n) => sum + n.wakes, 0);
  const wakeLabel =
    totalWakes === 1
      ? "1 nighttime wake-up"
      : `${totalWakes} nighttime wake-ups`;

  const ariaLabel = `Sleep over 7 nights: averaging ${avgHours} hours with ${totalWakes} ${totalWakes === 1 ? "wake-up" : "wake-ups"}`;

  const points = computePoints(nights);
  const polylinePoints = points.map((p) => `${p.x},${p.y}`).join(" ");

  return (
    <figure className={cn("w-full", className)}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        height={H}
        role="img"
        aria-label={ariaLabel}
        className="overflow-visible"
      >
        {/* Soft fill area under line */}
        <polyline
          points={polylinePoints}
          fill="none"
          stroke="var(--color-primary)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* Data point dots */}
        {points.map((p, i) => (
          <circle
            key={i}
            cx={p.x}
            cy={p.y}
            r={3}
            fill="var(--color-primary)"
            aria-hidden="true"
          />
        ))}
      </svg>

      <figcaption className="mt-2 flex gap-4 items-baseline">
        <span>
          <span className="font-mono text-sm font-semibold text-[var(--color-text-primary)]">
            {avgHours} h
          </span>{" "}
          <span className="text-xs text-[var(--color-muted)]">avg</span>
        </span>
        <span>
          <span className="font-mono text-sm font-semibold text-[var(--color-text-primary)]">
            {wakeLabel}
          </span>
        </span>
      </figcaption>
    </figure>
  );
}
