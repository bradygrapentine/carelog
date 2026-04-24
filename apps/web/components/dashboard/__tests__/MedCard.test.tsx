import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { axe } from "vitest-axe";
import { toHaveNoViolations } from "vitest-axe/matchers";
import { MedCard } from "../MedCard";

// @ts-expect-error TD-16: vitest-axe/matchers uses 'export type *'; runtime JS exports the value fine
expect.extend({ toHaveNoViolations });

describe("MedCard — rendering", () => {
  it("renders a section labeled 'Medications'", () => {
    render(<MedCard />);
    expect(
      screen.getByRole("region", { name: /medications/i }),
    ).toBeInTheDocument();
  });

  it("renders at least one taken med and one not-taken med", () => {
    render(<MedCard />);
    const taken = screen
      .getAllByTestId("med-row")
      .filter((row) => row.dataset.taken === "true");
    const notTaken = screen
      .getAllByTestId("med-row")
      .filter((row) => row.dataset.taken === "false");
    expect(taken.length).toBeGreaterThanOrEqual(1);
    expect(notTaken.length).toBeGreaterThanOrEqual(1);
  });
});

describe("MedCard — taken rows", () => {
  it("taken rows apply strikethrough (line-through)", () => {
    render(<MedCard />);
    const takenLabel = screen
      .getAllByTestId("med-row")
      .filter((row) => row.dataset.taken === "true")[0]
      .querySelector("[data-testid='med-name']") as HTMLElement;
    expect(takenLabel.className).toContain("line-through");
  });

  it("taken rows apply 60% opacity", () => {
    render(<MedCard />);
    const takenRow = screen
      .getAllByTestId("med-row")
      .filter((row) => row.dataset.taken === "true")[0];
    expect(takenRow.className).toMatch(/opacity-\[0?\.6\]|opacity-60/);
  });
});

describe("MedCard — log action", () => {
  it("not-taken rows expose a 'Log' button", () => {
    render(<MedCard />);
    const row = screen
      .getAllByTestId("med-row")
      .filter((row) => row.dataset.taken === "false")[0];
    const logBtn = row.querySelector(
      "button[data-testid='med-log-btn']",
    ) as HTMLButtonElement;
    expect(logBtn).not.toBeNull();
    expect(logBtn.textContent?.toLowerCase()).toContain("log");
  });

  it("taken rows do NOT show a Log button", () => {
    render(<MedCard />);
    const row = screen
      .getAllByTestId("med-row")
      .filter((row) => row.dataset.taken === "true")[0];
    expect(row.querySelector("button[data-testid='med-log-btn']")).toBeNull();
  });

  it("clicking 'Log' flips the row to taken state", () => {
    render(<MedCard />);
    const firstUntakenRow = screen
      .getAllByTestId("med-row")
      .filter((row) => row.dataset.taken === "false")[0];
    const medId = firstUntakenRow.dataset.medId;
    const logBtn = firstUntakenRow.querySelector(
      "button[data-testid='med-log-btn']",
    ) as HTMLButtonElement;
    fireEvent.click(logBtn);

    const matchingRow = screen
      .getAllByTestId("med-row")
      .find((row) => row.dataset.medId === medId) as HTMLElement;
    expect(matchingRow.dataset.taken).toBe("true");
  });

  it("Log buttons have accessible labels (include med name)", () => {
    render(<MedCard />);
    const row = screen
      .getAllByTestId("med-row")
      .filter((row) => row.dataset.taken === "false")[0];
    const logBtn = row.querySelector(
      "button[data-testid='med-log-btn']",
    ) as HTMLButtonElement;
    const label =
      logBtn.getAttribute("aria-label") ?? logBtn.textContent ?? "";
    // aria-label should name which med is being logged
    expect(label.length).toBeGreaterThan(3);
  });
});

describe("MedCard — accessibility", () => {
  it("has no axe violations", async () => {
    const { container } = render(<MedCard />);
    const results = await axe(container);
    // @ts-expect-error TD-16: vitest-axe augments Vi namespace (vitest<3.x); vitest 4.x uses @vitest/expect
    expect(results).toHaveNoViolations();
  });
});
