import { describe, it, expect } from "vitest";
import { shiftToCalendarEvent, getShiftEventClass } from "../ShiftCalendar";

describe("shiftToCalendarEvent", () => {
  const baseShift = {
    id: "shift-1",
    org_id: "org-1",
    recipient_id: "rec-1",
    start_at: "2026-04-15T08:00:00Z",
    end_at: "2026-04-15T12:00:00Z",
    status: "scheduled" as const,
    assignee_user_id: "user-1",
    assigned_display_name: "Sarah M.",
  };

  it("maps an assigned shift to a calendar event", () => {
    const event = shiftToCalendarEvent(baseShift);
    expect(event.title).toBe("Sarah M.");
    expect(event.start).toEqual(new Date("2026-04-15T08:00:00Z"));
    expect(event.end).toEqual(new Date("2026-04-15T12:00:00Z"));
    expect(event.resource.id).toBe("shift-1");
    expect(event.resource.status).toBe("scheduled");
  });

  it("labels unassigned shift as Unassigned", () => {
    const event = shiftToCalendarEvent({
      ...baseShift,
      assignee_user_id: null,
      assigned_display_name: null,
    });
    expect(event.title).toBe("Unassigned");
  });

  it("includes full shift as resource", () => {
    const event = shiftToCalendarEvent(baseShift);
    expect(event.resource).toEqual(baseShift);
  });
});

describe("getShiftEventClass", () => {
  it("returns primary class for scheduled shifts", () => {
    expect(getShiftEventClass("scheduled")).toBe("shift-event--scheduled");
  });
  it("returns danger class for unassigned shifts", () => {
    expect(getShiftEventClass(null)).toBe("shift-event--unassigned");
  });
  it("returns muted class for cancelled shifts", () => {
    expect(getShiftEventClass("cancelled")).toBe("shift-event--cancelled");
  });
});
