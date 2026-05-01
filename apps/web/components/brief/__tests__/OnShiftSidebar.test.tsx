import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { OnShiftSidebar } from "../OnShiftSidebar";

// ─── Fixtures ──────────────────────────────────────────────────────────────────

const ON_NOW = {
  id: "cg-1",
  name: "Sarah Chen",
  initials: "SC",
  shiftLabel: "8a–4p",
};

const UP_NEXT = {
  id: "cg-2",
  name: "Marcus Lee",
  initials: "ML",
};

const MOOD = {
  label: "difficult" as const,
  note: "She had trouble settling.",
  when: "yesterday, 7:42a",
  by: "Sarah Chen",
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("OnShiftSidebar", () => {
  it("renders the on-now caregiver name and 'ON NOW' eyebrow", () => {
    render(
      <OnShiftSidebar onNow={ON_NOW} upNext={UP_NEXT} latestMood={MOOD} />,
    );
    expect(screen.getByText("Sarah Chen")).toBeInTheDocument();
    expect(screen.getByText("ON NOW")).toBeInTheDocument();
  });

  it("renders the up-next caregiver name and 'UP NEXT' eyebrow", () => {
    render(
      <OnShiftSidebar onNow={ON_NOW} upNext={UP_NEXT} latestMood={MOOD} />,
    );
    expect(screen.getByText("Marcus Lee")).toBeInTheDocument();
    expect(screen.getByText("UP NEXT")).toBeInTheDocument();
  });

  it("when upNext === null, shows muted 'No one scheduled' placeholder", () => {
    render(
      <OnShiftSidebar onNow={ON_NOW} upNext={null} latestMood={MOOD} />,
    );
    expect(screen.getByText("No one scheduled")).toBeInTheDocument();
  });

  it("when latestMood !== null, renders the mood label + when + by", () => {
    render(
      <OnShiftSidebar onNow={ON_NOW} upNext={UP_NEXT} latestMood={MOOD} />,
    );
    expect(screen.getByText(/difficult/i)).toBeInTheDocument();
    expect(screen.getByText(/yesterday, 7:42a/)).toBeInTheDocument();
    expect(
      screen.getByText(/Sarah Chen/, { selector: "[data-testid='mood-by']" }),
    ).toBeInTheDocument();
  });

  it("when latestMood === null, the mood section is not rendered", () => {
    render(
      <OnShiftSidebar onNow={ON_NOW} upNext={UP_NEXT} latestMood={null} />,
    );
    expect(screen.queryByTestId("mood-section")).not.toBeInTheDocument();
  });

  it("mood dot has the appropriate aria-label (e.g. 'Mood: difficult')", () => {
    render(
      <OnShiftSidebar onNow={ON_NOW} upNext={UP_NEXT} latestMood={MOOD} />,
    );
    expect(screen.getByLabelText("Mood: difficult")).toBeInTheDocument();
  });

  it("when latestMood.note is provided, it renders", () => {
    render(
      <OnShiftSidebar onNow={ON_NOW} upNext={UP_NEXT} latestMood={MOOD} />,
    );
    expect(
      screen.getByText("She had trouble settling."),
    ).toBeInTheDocument();
  });

  it("when latestMood.note is omitted, it does not render", () => {
    const moodNoNote = { label: "good" as const, when: "today, 9a", by: "Marcus Lee" };
    render(
      <OnShiftSidebar onNow={ON_NOW} upNext={UP_NEXT} latestMood={moodNoNote} />,
    );
    expect(screen.queryByTestId("mood-note")).not.toBeInTheDocument();
  });

  it("on-now caregiver's shift label renders when provided", () => {
    render(
      <OnShiftSidebar onNow={ON_NOW} upNext={UP_NEXT} latestMood={MOOD} />,
    );
    expect(screen.getByText("8a–4p")).toBeInTheDocument();
  });
});
