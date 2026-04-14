// Generated Supabase types — run `npx supabase gen types typescript --project-id <ref>` to update
export type { Database } from "./supabase";

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
/** Lifecycle states for an OCR scan job (e.g. medication label scans). */
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

/** Represents the person receiving care; `identity_token` is an opaque reference used in place of real name to limit PHI in the client. */
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

/** A shareable, time-limited summary of a recipient's care information (medications, contacts, preferences) used for handoffs and provider visits. */
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

export type DocType =
  | "hipaa_authorization"
  | "power_of_attorney"
  | "advance_directive"
  | "insurance_card"
  | "medication_list"
  | "other";

export interface Document {
  id: string;
  org_id: string;
  recipient_id: string;
  display_name: string;
  doc_type: DocType;
  storage_path: string;
  mime_type: string;
  file_size: number;
  uploaded_by: string;
  created_at: string;
}

/** Records the answers and results from a government-benefits eligibility screener run for a recipient. */
export interface BenefitsScreening {
  id: string;
  org_id: string;
  recipient_id: string;
  answers: Record<string, unknown>;
  results: Record<string, unknown>;
  created_by: string;
  created_at: string;
}

/** The recipient's documented resuscitation preference, used in end-of-life planning. */
export type ResuscitationPref =
  | "full_code"
  | "dnr"
  | "comfort_only"
  | "undecided";

export interface EolPlan {
  id: string;
  org_id: string;
  recipient_id: string;
  healthcare_proxy: string | null;
  resuscitation_pref: ResuscitationPref | null;
  funeral_pref: string | null;
  legacy_message: string | null;
  attorney_name: string | null;
  attorney_contact: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

/** Stores an Expo push token for a user's device, used to send mobile push notifications. */
export interface PushToken {
  id: string;
  user_id: string;
  expo_token: string;
  platform: "ios" | "android";
  created_at: string;
  updated_at: string;
}

export interface UserProfile {
  id: string;
  display_name: string | null;
  email: string | null;
  created_at: string;
  updated_at: string;
}
