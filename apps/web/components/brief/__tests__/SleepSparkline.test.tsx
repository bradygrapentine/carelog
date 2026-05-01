import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { SleepSparkline } from "@/components/brief/SleepSparkline";

const makeNights = (overrides?: Partial<{ hours: number; wakes: number }>[]) =>
  Array.from({ length: 7 }, (_, i) => ({
    date: `2026-04-${String(i + 1).padStart(2, "0")}`,
    hours: 7,
    wakes: 0,
    ...(overrides?.[i] ?? {}),
  }));

const SEVEN_NIGHTS = [
  { date: "2026-04-01", hours: 6.5, wakes: 1 },
  { date: "2026-04-02", hours: 7.0, wakes: 0 },
  { date: "2026-04-03", hours: 5.2, wakes: 2 },
  { date: "2026-04-04", hours: 3.5, wakes: 3 },
  { date: "2026-04-05", hours: 8.0, wakes: 0 },
  { date: "2026-04-06", hours: 6.0, wakes: 1 },
  { date: "2026-04-07", hours: 7.8, wakes: 0 },
];
// avg = (6.5+7.0+5.2+3.5+8.0+6.0+7.8)/7 = 44.0/7 ≈ 6.3  wakes = 1+0+2+3+0+1+0 = 7

describe("SleepSparkline", () => {
  it("renders an SVG with role='img' when given 7 nights", () => {
    render(<SleepSparkline nights={SEVEN_NIGHTS} />);
    const svg = document.querySelector("svg");
    expect(svg).toBeTruthy();
    expect(svg?.getAttribute("role")).toBe("img");
  });

  it("computes correct average hours (rounded to 1 decimal) and renders it", () => {
    render(<SleepSparkline nights={SEVEN_NIGHTS} />);
    // avg = 44.0/7 = 6.285... → 6.3
    expect(screen.getByText(/6\.3/)).toBeTruthy();
  });

  it("computes correct total wake-ups and renders the plural label", () => {
    render(<SleepSparkline nights={SEVEN_NIGHTS} />);
    // total wakes = 7
    expect(screen.getByText(/7 nighttime wake-ups/)).toBeTruthy();
  });

  it("uses singular label when wake-ups total is exactly 1", () => {
    const nights = makeNights([{ wakes: 1 }, ...Array(6).fill({ wakes: 0 })]);
    render(<SleepSparkline nights={nights} />);
    expect(screen.getByText(/1 nighttime wake-up/)).toBeTruthy();
    // must NOT say "wake-ups" (plural)
    expect(screen.queryByText(/1 nighttime wake-ups/)).toBeNull();
  });

  it("returns null when given fewer than 7 nights", () => {
    const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { container } = render(
      <SleepSparkline nights={SEVEN_NIGHTS.slice(0, 5)} />,
    );
    expect(container.firstChild).toBeNull();
    consoleSpy.mockRestore();
  });

  it("aria-label includes avg hours and wake-up count", () => {
    render(<SleepSparkline nights={SEVEN_NIGHTS} />);
    const svg = document.querySelector("svg[role='img']");
    const label = svg?.getAttribute("aria-label") ?? "";
    expect(label).toMatch(/6\.3/);
    expect(label).toMatch(/7/);
  });

  it("SVG polyline or path has stroke set to var(--color-primary)", () => {
    render(<SleepSparkline nights={SEVEN_NIGHTS} />);
    const line =
      document.querySelector("polyline") ?? document.querySelector("path");
    expect(line).toBeTruthy();
    const stroke = line!.getAttribute("stroke");
    expect(stroke).toBe("var(--color-primary)");
  });

  it("handles all-zero hours without crashing", () => {
    const nights = makeNights(Array(7).fill({ hours: 0, wakes: 0 }));
    expect(() => render(<SleepSparkline nights={nights} />)).not.toThrow();
    const svg = document.querySelector("svg");
    expect(svg).toBeTruthy();
  });

  it("renders a flat line when all hours are identical", () => {
    // All same value → all y-coordinates must be equal.
    const nights = makeNights(Array(7).fill({ hours: 6, wakes: 0 }));
    render(<SleepSparkline nights={nights} />);
    const polyline = document.querySelector("polyline");
    if (polyline) {
      const points = polyline.getAttribute("points") ?? "";
      const yValues = points
        .trim()
        .split(/\s+/)
        .map((pair) => pair.split(",")[1])
        .filter(Boolean);
      const unique = new Set(yValues);
      expect(unique.size).toBe(1);
    } else {
      // If using <path>, check that all y values after L/M commands are equal
      const path = document.querySelector("path");
      expect(path).toBeTruthy();
      const d = path?.getAttribute("d") ?? "";
      // Extract y coordinates from M/L commands like "M6,20 L50,20 ..."
      const coords = [...d.matchAll(/[ML][\d.]+,([\d.]+)/g)].map((m) => m[1]);
      if (coords.length > 0) {
        const unique = new Set(coords);
        expect(unique.size).toBe(1);
      }
    }
  });
});
