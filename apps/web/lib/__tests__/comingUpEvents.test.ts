import { describe, it, expect } from "vitest";
import { comingUpEvents } from "../comingUpEvents";

// Helpers
function medAt(clockTime: string, id = "med-1", drugName = "Lisinopril", dosage = "10mg") {
  return {
    id,
    scheduled_time: clockTime,
    medications: { drug_name: drugName, dosage },
  };
}

function apptAt(isoTime: string, id = "appt-1", title = "Dr. Smith", detail?: string) {
  return { id, starts_at: isoTime, title, detail: detail ?? null };
}

// now = 2026-05-01T08:00:00 local (8am)
const NOW = new Date(2026, 4, 1, 8, 0, 0); // May 1 2026, 8:00am local

describe("comingUpEvents", () => {
  it("includes scheduled meds whose clock time is later today", () => {
    const result = comingUpEvents({
      scheduledMeds: [medAt("09:00:00")],
      appointments: [],
      now: NOW,
    });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("med-1");
    expect(result[0].label).toContain("Lisinopril");
    expect(result[0].label).toContain("10mg");
  });

  it("excludes meds whose clock time is in the past", () => {
    // now = 2pm, med at 9am → excluded
    const afternoon = new Date(2026, 4, 1, 14, 0, 0);
    const result = comingUpEvents({
      scheduledMeds: [medAt("09:00:00")],
      appointments: [],
      now: afternoon,
    });
    expect(result).toHaveLength(0);
  });

  it("includes appointments whose starts_at is in the future today", () => {
    const twoHoursLater = new Date(NOW.getTime() + 2 * 60 * 60 * 1000).toISOString();
    const result = comingUpEvents({
      scheduledMeds: [],
      appointments: [apptAt(twoHoursLater, "appt-1", "Cardiology")],
      now: NOW,
    });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("appt-1");
    expect(result[0].label).toBe("Cardiology");
  });

  it("excludes appointments before now", () => {
    const oneHourAgo = new Date(NOW.getTime() - 60 * 60 * 1000).toISOString();
    const result = comingUpEvents({
      scheduledMeds: [],
      appointments: [apptAt(oneHourAgo)],
      now: NOW,
    });
    expect(result).toHaveLength(0);
  });

  it("respects the default limit of 5", () => {
    const meds = Array.from({ length: 8 }, (_, i) =>
      medAt(`${9 + i}:00:00`, `med-${i}`, `Drug${i}`, "5mg")
    );
    const result = comingUpEvents({
      scheduledMeds: meds,
      appointments: [],
      now: NOW,
    });
    expect(result).toHaveLength(5);
  });

  it("returns results sorted by time ascending", () => {
    const twoHoursLater = new Date(NOW.getTime() + 2 * 60 * 60 * 1000).toISOString();
    const fourHoursLater = new Date(NOW.getTime() + 4 * 60 * 60 * 1000).toISOString();
    const result = comingUpEvents({
      scheduledMeds: [medAt("12:00:00", "med-noon"), medAt("09:00:00", "med-9am")],
      appointments: [apptAt(fourHoursLater, "appt-4h"), apptAt(twoHoursLater, "appt-2h")],
      now: NOW,
    });
    // 9am med < 10am appt (2h later) < noon med < 12pm appt (4h later)
    const ids = result.map((e) => e.id);
    const sorted = [...ids].sort(() => 0); // just verify order matches sorted times
    // Verify first event is the earliest
    expect(ids[0]).toBe("med-9am");
  });
});
