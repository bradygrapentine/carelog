import { describe, it, expect } from "vitest";
import { eolPlanUpsertInput } from "../eolPlan";

const BASE = {
  org_id: "00000000-0000-0000-0000-000000000001",
  recipient_id: "00000000-0000-0000-0000-000000000002",
};

describe("eolPlanUpsertInput", () => {
  it("accepts minimal input (org_id + recipient_id only)", () => {
    expect(eolPlanUpsertInput.safeParse(BASE).success).toBe(true);
  });

  it("accepts full input with all optional fields", () => {
    const result = eolPlanUpsertInput.safeParse({
      ...BASE,
      healthcare_proxy: "Jane Smith - 555-0199",
      resuscitation_pref: "dnr",
      funeral_pref: "Cremation",
      legacy_message: "I love you all.",
      attorney_name: "Bob Jones",
      attorney_contact: "bjones@lawfirm.com",
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid resuscitation_pref", () => {
    expect(
      eolPlanUpsertInput.safeParse({
        ...BASE,
        resuscitation_pref: "maybe",
      }).success,
    ).toBe(false);
  });

  it("accepts all valid resuscitation_pref values", () => {
    for (const pref of ["full", "dnr", "dnr_comfort_only"]) {
      expect(
        eolPlanUpsertInput.safeParse({ ...BASE, resuscitation_pref: pref })
          .success,
      ).toBe(true);
    }
  });

  it("rejects non-uuid org_id", () => {
    expect(
      eolPlanUpsertInput.safeParse({ ...BASE, org_id: "bad-id" }).success,
    ).toBe(false);
  });

  it("rejects non-uuid recipient_id", () => {
    expect(
      eolPlanUpsertInput.safeParse({ ...BASE, recipient_id: "bad-id" }).success,
    ).toBe(false);
  });
});
