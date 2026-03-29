export type OrgType = "family" | "agency" | "institution" | "employer";
export type OrgPlan = "free" | "family" | "professional" | "enterprise";
export type MemberRole = "coordinator" | "caregiver" | "supporter" | "aide";
export type EventType =
  | "journal"
  | "medication"
  | "shift"
  | "appointment"
  | "symptom"
  | "task"
  | "expense"
  | "handoff";
export type EntryKind = "human" | "system";
export type ShiftStatus =
  | "open"
  | "claimed"
  | "confirmed"
  | "completed"
  | "missed";
export type OcrJobStatus =
  | "pending"
  | "processing"
  | "needs_review"
  | "confirmed"
  | "failed";

export interface Organization {
  id: string;
  name: string;
  org_type: OrgType;
  plan: OrgPlan;
  stripe_id: string | null;
  created_at: string;
}

export interface Membership {
  id: string;
  org_id: string;
  user_id: string;
  recipient_id: string | null;
  role: MemberRole;
  invited_at: string;
  accepted_at: string | null;
}

export interface CareRecipient {
  id: string;
  org_id: string;
  identity_token: string;
  diagnoses: string[];
  allergies: string[];
  created_at: string;
  // Resolved at server layer — never stored here
  display_name?: string;
}

export interface CareEvent {
  id: string;
  org_id: string;
  recipient_id: string;
  actor_id: string;
  event_type: EventType;
  entry_kind: EntryKind;
  payload: Record<string, unknown>;
  flagged: boolean;
  occurred_at: string;
  created_at: string;
}

export interface Medication {
  id: string;
  org_id: string;
  recipient_id: string;
  drug_name: string;
  brand_name: string | null;
  dosage: string;
  form: string | null;
  instructions: string | null;
  prescriber: string | null;
  pharmacy: string | null;
  pharmacy_phone: string | null;
  refills_remaining: number | null;
  supply_days_remaining: number | null;
  last_refill_date: string | null;
  active: boolean;
  scan_source: "manual" | "ocr_scan";
  created_at: string;
}

export interface JournalReaction {
  id: string;
  event_id: string;
  user_id: string;
  reaction: "heart" | "thinking_of_you" | "strong" | "grateful";
  note: string | null;
  created_at: string;
}

export interface CareBrief {
  id: string;
  org_id: string;
  recipient_id: string;
  share_token: string;
  title: string;
  content: CareBriefContent;
  includes: string[];
  expires_at: string | null;
  revoked: boolean;
  created_by: string;
  created_at: string;
}

export interface CareBriefContent {
  name: string;
  dob: string | null;
  medications: Array<{ name: string; dose: string; schedule: string }>;
  preferences: Record<string, unknown>;
  contacts: Array<{ name: string; relationship: string; phone: string }>;
  generated_at: string;
}
