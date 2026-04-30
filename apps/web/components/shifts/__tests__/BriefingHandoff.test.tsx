import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { BriefingHandoff } from "../BriefingHandoff";

const baseProps = {
  from: "Sarah",
  to: "you",
  minutesUntil: 38,
  summary: "Three doses missed overnight, one hard wake at 2a.",
  sleep: {
    severity: "difficult" as const,
    text: "Up at 2a, took 90m to settle.",
  },
  meds: { severity: "okay" as const, text: "Donepezil missed; calcium given." },
  schedule: { severity: "good" as const, text: "PT at 10a; ride confirmed." },
};

describe("<BriefingHandoff />", () => {
  it("renders the handoff banner with from and to in the editorial headline", () => {
    render(<BriefingHandoff {...baseProps} />);
    const banner = screen.getByTestId("briefing-handoff-banner");
    expect(banner).toHaveTextContent(/Sarah/);
    expect(banner).toHaveTextContent(/handing off to/);
    expect(banner).toHaveTextContent(/you/);
  });

  it("formats the handoff window correctly across ranges", () => {
    const { rerender } = render(
      <BriefingHandoff {...baseProps} minutesUntil={38} />,
    );
    expect(screen.getByTestId("briefing-handoff-banner")).toHaveTextContent(
      /Handoff in 38 min/,
    );
    rerender(<BriefingHandoff {...baseProps} minutesUntil={150} />);
    expect(screen.getByTestId("briefing-handoff-banner")).toHaveTextContent(
      /Handoff in 2h 30m/,
    );
    rerender(<BriefingHandoff {...baseProps} minutesUntil={120} />);
    expect(screen.getByTestId("briefing-handoff-banner")).toHaveTextContent(
      /Handoff in 2hSarah/,
    );
    rerender(<BriefingHandoff {...baseProps} minutesUntil={-15} />);
    expect(screen.getByTestId("briefing-handoff-banner")).toHaveTextContent(
      /Handoff 15 min ago/,
    );
  });

  it("renders the three sections with their text", () => {
    render(<BriefingHandoff {...baseProps} />);
    expect(screen.getByTestId("briefing-section-sleep")).toHaveTextContent(
      "Up at 2a, took 90m to settle.",
    );
    expect(screen.getByTestId("briefing-section-meds")).toHaveTextContent(
      "Donepezil missed; calcium given.",
    );
    expect(screen.getByTestId("briefing-section-schedule")).toHaveTextContent(
      "PT at 10a; ride confirmed.",
    );
  });

  it("uses semantic article + ordered-list", () => {
    render(<BriefingHandoff {...baseProps} />);
    expect(screen.getByRole("article")).toBeInTheDocument();
    expect(
      screen.getByRole("list", { name: /three lines/i }),
    ).toBeInTheDocument();
  });
});
