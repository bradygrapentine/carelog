import {
  formatCurrency,
  formatWeekStamp,
  formatFileSize,
  canInvite,
  canLogSymptoms,
  canLogExpense,
  canUploadDocument,
  canDeleteExpense,
  EXPENSE_CATEGORIES,
  DOC_TYPES,
  APPETITE_OPTIONS,
  MOBILITY_OPTIONS,
} from "../utils/wave5Utils";

describe("wave5Utils", () => {
  describe("formatCurrency", () => {
    it("formats whole numbers", () => {
      expect(formatCurrency(42)).toBe("$42.00");
    });
    it("formats decimals", () => {
      expect(formatCurrency(42.5)).toBe("$42.50");
    });
    it("formats zero", () => {
      expect(formatCurrency(0)).toBe("$0.00");
    });
    it("formats large amounts", () => {
      expect(formatCurrency(1234.56)).toBe("$1,234.56");
    });
  });

  describe("formatWeekStamp", () => {
    it("parses ISO week to readable string", () => {
      const result = formatWeekStamp("2026-W15");
      expect(result).toContain("Apr");
    });
    it("returns input for invalid stamp", () => {
      expect(formatWeekStamp("bad")).toBe("bad");
    });
  });

  describe("formatFileSize", () => {
    it("formats bytes", () => {
      expect(formatFileSize(512)).toBe("512 B");
    });
    it("formats kilobytes", () => {
      expect(formatFileSize(2048)).toBe("2.0 KB");
    });
    it("formats megabytes", () => {
      expect(formatFileSize(1048576)).toBe("1.0 MB");
    });
    it("formats zero", () => {
      expect(formatFileSize(0)).toBe("0 B");
    });
  });

  describe("canInvite", () => {
    it("coordinator can invite", () => {
      expect(canInvite("coordinator")).toBe(true);
    });
    it("caregiver cannot invite", () => {
      expect(canInvite("caregiver")).toBe(false);
    });
    it("supporter cannot invite", () => {
      expect(canInvite("supporter")).toBe(false);
    });
    it("aide cannot invite", () => {
      expect(canInvite("aide")).toBe(false);
    });
    it("null cannot invite", () => {
      expect(canInvite(null)).toBe(false);
    });
  });

  describe("canLogSymptoms", () => {
    it("coordinator can log", () => {
      expect(canLogSymptoms("coordinator")).toBe(true);
    });
    it("caregiver can log", () => {
      expect(canLogSymptoms("caregiver")).toBe(true);
    });
    it("supporter cannot log", () => {
      expect(canLogSymptoms("supporter")).toBe(false);
    });
    it("aide cannot log", () => {
      expect(canLogSymptoms("aide")).toBe(false);
    });
    it("null cannot log", () => {
      expect(canLogSymptoms(null)).toBe(false);
    });
  });

  describe("canLogExpense", () => {
    it("coordinator can log", () => {
      expect(canLogExpense("coordinator")).toBe(true);
    });
    it("caregiver can log", () => {
      expect(canLogExpense("caregiver")).toBe(true);
    });
    it("supporter cannot log", () => {
      expect(canLogExpense("supporter")).toBe(false);
    });
    it("null cannot log", () => {
      expect(canLogExpense(null)).toBe(false);
    });
  });

  describe("canUploadDocument", () => {
    it("coordinator can upload", () => {
      expect(canUploadDocument("coordinator")).toBe(true);
    });
    it("caregiver cannot upload", () => {
      expect(canUploadDocument("caregiver")).toBe(false);
    });
    it("null cannot upload", () => {
      expect(canUploadDocument(null)).toBe(false);
    });
  });

  describe("canDeleteExpense", () => {
    it("coordinator can delete", () => {
      expect(canDeleteExpense("coordinator")).toBe(true);
    });
    it("caregiver cannot delete", () => {
      expect(canDeleteExpense("caregiver")).toBe(false);
    });
    it("null cannot delete", () => {
      expect(canDeleteExpense(null)).toBe(false);
    });
  });

  describe("constants", () => {
    it("EXPENSE_CATEGORIES has 8 items", () => {
      expect(EXPENSE_CATEGORIES).toHaveLength(8);
    });
    it("DOC_TYPES has 6 items", () => {
      expect(DOC_TYPES).toHaveLength(6);
    });
    it("APPETITE_OPTIONS has 4 items", () => {
      expect(APPETITE_OPTIONS).toHaveLength(4);
    });
    it("MOBILITY_OPTIONS has 4 items", () => {
      expect(MOBILITY_OPTIONS).toHaveLength(4);
    });
  });
});
