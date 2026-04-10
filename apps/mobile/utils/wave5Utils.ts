// --- Types ---

export type ExpenseCategory =
  | "medication"
  | "supplies"
  | "equipment"
  | "home_modification"
  | "aide_hours"
  | "transport"
  | "food"
  | "other";

export type DocType =
  | "hipaa_authorization"
  | "power_of_attorney"
  | "advance_directive"
  | "insurance_card"
  | "medication_list"
  | "other";

export type Appetite = "normal" | "reduced" | "poor" | "none";
export type Mobility = "normal" | "limited" | "assisted" | "bedbound";

// --- Constants ---

export const EXPENSE_CATEGORIES: { key: ExpenseCategory; label: string }[] = [
  { key: "medication", label: "Medication" },
  { key: "supplies", label: "Supplies" },
  { key: "equipment", label: "Equipment" },
  { key: "home_modification", label: "Home modification" },
  { key: "aide_hours", label: "Aide hours" },
  { key: "transport", label: "Transport" },
  { key: "food", label: "Food" },
  { key: "other", label: "Other" },
];

export const DOC_TYPES: { key: DocType; label: string }[] = [
  { key: "hipaa_authorization", label: "HIPAA authorization" },
  { key: "power_of_attorney", label: "Power of attorney" },
  { key: "advance_directive", label: "Advance directive" },
  { key: "insurance_card", label: "Insurance card" },
  { key: "medication_list", label: "Medication list" },
  { key: "other", label: "Other" },
];

export const APPETITE_OPTIONS: { key: Appetite; label: string }[] = [
  { key: "normal", label: "Normal" },
  { key: "reduced", label: "Reduced" },
  { key: "poor", label: "Poor" },
  { key: "none", label: "None" },
];

export const MOBILITY_OPTIONS: { key: Mobility; label: string }[] = [
  { key: "normal", label: "Normal" },
  { key: "limited", label: "Limited" },
  { key: "assisted", label: "Assisted" },
  { key: "bedbound", label: "Bedbound" },
];

// --- Formatters ---

export function formatCurrency(amount: number): string {
  return (
    "$" +
    amount.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  );
}

export function formatWeekStamp(stamp: string): string {
  const match = stamp.match(/^(\d{4})-W(\d{2})$/);
  if (!match) return stamp;
  const year = parseInt(match[1], 10);
  const week = parseInt(match[2], 10);
  const jan4 = new Date(year, 0, 4);
  const dayOfWeek = jan4.getDay() || 7;
  const monday = new Date(jan4);
  monday.setDate(jan4.getDate() - dayOfWeek + 1 + (week - 1) * 7);
  const monthName = monday.toLocaleDateString("en-US", { month: "short" });
  return "Week of " + monthName + " " + monday.getDate();
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

// --- Permission helpers ---

export function canInvite(role: string | null): boolean {
  return role === "coordinator";
}

export function canLogSymptoms(role: string | null): boolean {
  return role === "coordinator" || role === "caregiver";
}

export function canLogExpense(role: string | null): boolean {
  return role === "coordinator" || role === "caregiver";
}

export function canUploadDocument(role: string | null): boolean {
  return role === "coordinator";
}

export function canDeleteExpense(role: string | null): boolean {
  return role === "coordinator";
}
