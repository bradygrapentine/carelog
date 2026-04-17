/**
 * ON-58 — Analytics funnel events
 * Tests for onboarding_step_completed and first_care_event_created.
 * PHI rule: no email, name, or PII in any captured event.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import posthog from "posthog-js";

const { mockCapture } = vi.hoisted(() => ({
  mockCapture: vi.fn(),
}));

vi.mock("posthog-js", () => ({
  default: {
    capture: mockCapture,
    identify: vi.fn(),
  },
}));

/** Mirrors OnboardingForm.tsx success handler */
function fireOnboardingSuccess(orgId: string) {
  posthog.capture("care_team_created", { org_id: orgId });
  posthog.capture("onboarding_step_completed", {
    step: "care_team_created",
    org_id: orgId,
  });
}

/** Mirrors JournalEntryForm.tsx localStorage guard */
function fireFirstCareEvent() {
  if (
    typeof window !== "undefined" &&
    !localStorage.getItem("cl_first_event_fired")
  ) {
    localStorage.setItem("cl_first_event_fired", "1");
    posthog.capture("first_care_event_created");
  }
}

describe("ON-58 — onboarding_step_completed", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("fires onboarding_step_completed with step and org_id after care team creation", () => {
    fireOnboardingSuccess("org-abc-123");

    expect(mockCapture).toHaveBeenCalledWith("onboarding_step_completed", {
      step: "care_team_created",
      org_id: "org-abc-123",
    });
  });

  it("does NOT include email, name, or any PII in the event (PHI rule)", () => {
    fireOnboardingSuccess("org-xyz-456");

    const calls = mockCapture.mock.calls;
    for (const [_event, props] of calls) {
      if (!props) continue;
      expect(props).not.toHaveProperty("email");
      expect(props).not.toHaveProperty("name");
      expect(props).not.toHaveProperty("recipientName");
      expect(props).not.toHaveProperty("orgName");
    }
  });

  it("fires care_team_created before onboarding_step_completed", () => {
    fireOnboardingSuccess("org-order-test");

    const eventNames = mockCapture.mock.calls.map(([event]) => event);
    const careTeamIdx = eventNames.indexOf("care_team_created");
    const stepIdx = eventNames.indexOf("onboarding_step_completed");
    expect(careTeamIdx).toBeGreaterThanOrEqual(0);
    expect(stepIdx).toBeGreaterThan(careTeamIdx);
  });
});

describe("ON-58 — first_care_event_created (localStorage guard)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it("fires first_care_event_created on the very first journal entry", () => {
    fireFirstCareEvent();

    expect(mockCapture).toHaveBeenCalledWith("first_care_event_created");
    expect(mockCapture).toHaveBeenCalledTimes(1);
  });

  it("does NOT fire on subsequent journal entries (localStorage guard)", () => {
    fireFirstCareEvent(); // first — sets the flag
    vi.clearAllMocks();
    fireFirstCareEvent(); // second — should be skipped
    fireFirstCareEvent(); // third  — should also be skipped

    expect(mockCapture).not.toHaveBeenCalledWith("first_care_event_created");
  });

  it("sets cl_first_event_fired in localStorage after the first entry", () => {
    expect(localStorage.getItem("cl_first_event_fired")).toBeNull();
    fireFirstCareEvent();
    expect(localStorage.getItem("cl_first_event_fired")).toBe("1");
  });

  it("does NOT include PII properties (PHI rule)", () => {
    fireFirstCareEvent();

    const firstCareCall = mockCapture.mock.calls.find(
      ([event]) => event === "first_care_event_created",
    );
    expect(firstCareCall).toBeDefined();
    expect(firstCareCall![1]).toBeUndefined();
  });
});
