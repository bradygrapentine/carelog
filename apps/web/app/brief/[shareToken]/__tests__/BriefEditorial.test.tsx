import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { BriefEditorial } from "../BriefEditorial";

const fixtureBrief = {
  id: "brief-1",
  title: "Care brief",
  created_at: "2026-04-26T07:02:00.000Z",
  includes: ["medications", "journal"],
  content: {
    recipient_name: "Eleanor",
    dob: "1942-03-12",
    generated_at: "2026-04-26T07:02:00.000Z",
    medications: [
      {
        drug_name: "Metformin",
        dosage: "500mg",
        instructions: "with breakfast",
      },
      { drug_name: "Lisinopril", dosage: "10mg", instructions: null },
    ],
    recent_entries: [
      {
        occurred_at: "2026-04-25T18:00:00.000Z",
        text: "Eleanor walked in the garden for 20 minutes.",
        mood: "good",
        flagged: false,
      },
      {
        occurred_at: "2026-04-24T10:00:00.000Z",
        text: "Refused breakfast and seemed disoriented after waking.",
        mood: "difficult",
        flagged: true,
      },
      {
        occurred_at: "2026-04-23T14:00:00.000Z",
        text: "Family called; she lit up describing childhood summers.",
        mood: "good",
        flagged: false,
      },
    ],
  },
};

describe("BriefEditorial", () => {
  it("renders a Fraunces-token headline naming the recipient", () => {
    render(<BriefEditorial brief={fixtureBrief} />);
    const headline = screen.getByRole("heading", { level: 1 });
    expect(headline).toHaveClass("headline-display");
    expect(headline.textContent).toMatch(/Eleanor/);
  });

  it("renders the eyebrow-mono dateline above the headline", () => {
    render(<BriefEditorial brief={fixtureBrief} />);
    const eyebrow = screen.getByText(/today's brief/i);
    expect(eyebrow).toHaveClass("eyebrow-mono");
  });

  it("constrains the article to max-w-[720px]", () => {
    const { container } = render(<BriefEditorial brief={fixtureBrief} />);
    const article = container.querySelector("article");
    expect(article).not.toBeNull();
    expect(article?.className).toMatch(/max-w-\[720px\]/);
  });

  it("renders Email family and Print for visit actions with aria-labels", () => {
    render(<BriefEditorial brief={fixtureBrief} />);
    expect(
      screen.getByRole("button", { name: /email family/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /print for visit/i }),
    ).toBeInTheDocument();
  });

  it("Print for visit triggers window.print", () => {
    const printSpy = vi.fn();
    const original = window.print;
    window.print = printSpy;
    try {
      render(<BriefEditorial brief={fixtureBrief} />);
      fireEvent.click(screen.getByRole("button", { name: /print for visit/i }));
      expect(printSpy).toHaveBeenCalledTimes(1);
    } finally {
      window.print = original;
    }
  });

  it("renders a doctor-bullet section using the headline-display token", () => {
    render(<BriefEditorial brief={fixtureBrief} />);
    const doctorHeading = screen.getByRole("heading", {
      level: 2,
      name: /for your next visit/i,
    });
    expect(doctorHeading).toHaveClass("headline-display");
  });

  it("surfaces flagged journal entries in the doctor-bullet list", () => {
    render(<BriefEditorial brief={fixtureBrief} />);
    // The flagged entry text appears in both the body paragraph and the
    // doctor section — assert it's referenced from a <li> under the
    // "Flagged this week" sub-heading.
    const matches = screen.getAllByText(/refused breakfast/i);
    expect(matches.length).toBeGreaterThanOrEqual(2);
    expect(matches.some((el) => el.closest("li") != null)).toBe(true);
  });

  it("lists active medications in the doctor-bullet section", () => {
    render(<BriefEditorial brief={fixtureBrief} />);
    expect(screen.getByText(/metformin/i)).toBeInTheDocument();
    expect(screen.getByText(/lisinopril/i)).toBeInTheDocument();
  });

  it("renders body paragraphs sourced from recent_entries", () => {
    render(<BriefEditorial brief={fixtureBrief} />);
    expect(screen.getByText(/walked in the garden/i)).toBeInTheDocument();
    expect(
      screen.getByText(/lit up describing childhood summers/i),
    ).toBeInTheDocument();
  });
});
