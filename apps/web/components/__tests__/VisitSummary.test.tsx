import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { VisitSummary, type VisitSummaryProps } from "../VisitSummary";

// ── Fixtures ──────────────────────────────────────────────────────────────────

const NOW_ISO = "2026-04-23T12:00:00Z";

const baseRecipient: VisitSummaryProps["recipient"] = {
  name: "Margaret Johnson",
  dob: "1945-03-15",
};

const activeMed: VisitSummaryProps["medications"][0] = {
  id: "med-1",
  drug_name: "Metoprolol",
  dosage: "25mg",
  form: "tablet",
  instructions: "once daily",
  prescriber: "Dr. Smith",
  active: true,
};

const noScheduleMed: VisitSummaryProps["medications"][0] = {
  id: "med-2",
  drug_name: "Aspirin",
  dosage: "81mg",
  form: null,
  instructions: "as needed",
  prescriber: null,
  active: true,
};

const doseEvent: VisitSummaryProps["doseEvents"][0] = {
  id: "evt-1",
  recipient_id: "rec-1",
  occurred_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
  event_type: "medication_dose",
  entry_kind: "medication",
  flagged: false,
  payload: { medication_id: "med-1" },
};

const symptomReading: VisitSummaryProps["symptomReadings"][0] = {
  id: "sym-1",
  pain_level: 4,
  mood: "okay",
  appetite: null,
  mobility: null,
  notes: "Mild discomfort after walk",
  recorded_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
};

const journalEntry: VisitSummaryProps["journalEntries"][0] = {
  id: "jnl-1",
  recipient_id: "rec-1",
  occurred_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
  event_type: "journal",
  entry_kind: "journal",
  flagged: true,
  payload: { note: "Patient was unusually tired after lunch. BP slightly elevated." },
};

function renderSummary(overrides: Partial<VisitSummaryProps> = {}) {
  const props: VisitSummaryProps = {
    recipient: baseRecipient,
    medications: [activeMed],
    doseEvents: [doseEvent],
    symptomReadings: [symptomReading],
    journalEntries: [journalEntry],
    generatedAt: NOW_ISO,
    ...overrides,
  };
  return render(<VisitSummary {...props} />);
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("<VisitSummary />", () => {
  // ── Section rendering ────────────────────────────────────────────────────────

  it("renders the Visit Summary heading", () => {
    renderSummary();
    expect(screen.getByRole("heading", { name: /visit summary/i, level: 1 })).toBeInTheDocument();
  });

  it("renders the Patient Information section", () => {
    renderSummary();
    expect(screen.getByText(/patient information/i)).toBeInTheDocument();
    expect(screen.getByText(/margaret johnson/i)).toBeInTheDocument();
  });

  it("renders patient age from DOB", () => {
    renderSummary();
    // Born 1945-03-15, today 2026-04-23 → age 81
    expect(screen.getByText(/age 81/i)).toBeInTheDocument();
  });

  it("renders the Medications & Adherence section", () => {
    renderSummary();
    expect(screen.getByText(/medications.*adherence/i)).toBeInTheDocument();
    expect(screen.getByText(/metoprolol/i)).toBeInTheDocument();
  });

  it("renders the Vitals Trends section heading", () => {
    renderSummary();
    expect(screen.getByText(/vitals trends/i)).toBeInTheDocument();
  });

  it("renders the Recent Symptoms section", () => {
    renderSummary();
    expect(screen.getByText(/recent symptoms/i)).toBeInTheDocument();
  });

  it("renders the Journal Highlights section", () => {
    renderSummary();
    expect(screen.getByText(/journal highlights/i)).toBeInTheDocument();
  });

  it("renders the Questions for the Doctor section with textarea", () => {
    renderSummary();
    expect(screen.getByText(/questions for the doctor/i)).toBeInTheDocument();
    expect(
      screen.getByRole("textbox", { name: /questions for the doctor/i }),
    ).toBeInTheDocument();
  });

  // ── Empty data states ────────────────────────────────────────────────────────

  it("shows 'No active medications on record' when medications is empty", () => {
    renderSummary({ medications: [] });
    expect(screen.getByText(/no active medications on record/i)).toBeInTheDocument();
  });

  it("shows 'Adherence unavailable' for med with no schedule", () => {
    renderSummary({ medications: [noScheduleMed], doseEvents: [] });
    expect(screen.getByText(/adherence unavailable/i)).toBeInTheDocument();
  });

  it("shows 'No symptoms recorded' when symptomReadings is empty", () => {
    renderSummary({ symptomReadings: [] });
    expect(screen.getByText(/no symptoms recorded/i)).toBeInTheDocument();
  });

  it("shows 'No journal entries recorded' when journalEntries is empty", () => {
    renderSummary({ journalEntries: [] });
    expect(screen.getByText(/no journal entries recorded/i)).toBeInTheDocument();
  });

  it("shows vitals not enough data message when fewer than 3 readings", () => {
    renderSummary({ symptomReadings: [symptomReading] });
    expect(screen.getByText(/not enough data to show trends/i)).toBeInTheDocument();
  });

  // ── Print CSS ────────────────────────────────────────────────────────────────

  it("applies visit-summary class to article (print target)", () => {
    const { container } = renderSummary();
    const article = container.querySelector("article.visit-summary");
    expect(article).toBeInTheDocument();
  });

  // ── Pre-filled questions ─────────────────────────────────────────────────────

  it("pre-fills questions textarea from props", () => {
    renderSummary({ questions: "Is the current dosage still appropriate?" });
    const textarea = screen.getByRole("textbox", {
      name: /questions for the doctor/i,
    }) as HTMLTextAreaElement;
    expect(textarea.value).toBe("Is the current dosage still appropriate?");
  });

  // ── A11y: semantic landmark regions ─────────────────────────────────────────

  it("each section has an accessible name via aria-labelledby", () => {
    const { container } = renderSummary();
    const sections = container.querySelectorAll("section[aria-labelledby]");
    expect(sections.length).toBeGreaterThanOrEqual(6);
  });

  it("renders a top-level article landmark", () => {
    renderSummary();
    expect(screen.getByRole("article")).toBeInTheDocument();
  });

  it("renders symptom entries with time elements", () => {
    const multipleReadings: VisitSummaryProps["symptomReadings"] = Array.from(
      { length: 3 },
      (_, i) => ({
        ...symptomReading,
        id: `sym-${i}`,
        recorded_at: new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString(),
      }),
    );
    renderSummary({ symptomReadings: multipleReadings });
    const timeEls = screen.getAllByRole("time");
    expect(timeEls.length).toBeGreaterThanOrEqual(1);
  });
});
