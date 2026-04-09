import { describe, it, expect } from "vitest";
import { coverageWindowCreateInput } from "../coverageWindows";

const valid = {
  org_id: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
  recipient_id: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
  label: "Weekday morning",
  starts_at: "07:00",
  ends_at: "12:00",
  required_role: "caregiver" as const,
  day_of_week: 1,
  recurring: true as const,
};

describe("coverageWindowCreateInput", () => {
  it("accepts valid input", () => {
    const result = coverageWindowCreateInput.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it("rejects missing label", () => {
    const result = coverageWindowCreateInput.safeParse({ ...valid, label: "" });
    expect(result.success).toBe(false);
  });

  it("rejects day_of_week = 7", () => {
    const result = coverageWindowCreateInput.safeParse({ ...valid, day_of_week: 7 });
    expect(result.success).toBe(false);
  });

  it("rejects day_of_week = -1", () => {
    const result = coverageWindowCreateInput.safeParse({ ...valid, day_of_week: -1 });
    expect(result.success).toBe(false);
  });

  it("rejects ends_at <= starts_at", () => {
    const result = coverageWindowCreateInput.safeParse({ ...valid, ends_at: "06:00" });
    expect(result.success).toBe(false);
  });

  it("rejects ends_at equal to starts_at", () => {
    const result = coverageWindowCreateInput.safeParse({ ...valid, ends_at: "07:00" });
    expect(result.success).toBe(false);
  });

  it("rejects invalid role", () => {
    const result = coverageWindowCreateInput.safeParse({ ...valid, required_role: "admin" });
    expect(result.success).toBe(false);
  });
});
