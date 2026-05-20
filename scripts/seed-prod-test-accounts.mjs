#!/usr/bin/env node
// scripts/seed-prod-test-accounts.mjs — populate the locked-down prod test
// accounts with a synthetic care scenario (TD-219).
//
// THIS IS A SERVICE-ROLE PROD WRITE. It is gated behind multiple guards and is
// NEVER run by CI or by default. It is a manual operator step, run once after
// the 4 prod test accounts are confirmed.
//
// ── Guards (all required to write anything) ─────────────────────────────────
//   SEED_PROD_TEST=1                  explicit opt-in flag
//   SUPABASE_URL                      target project URL (host is echoed)
//   SUPABASE_SERVICE_ROLE_KEY         service-role key (env only — never logged)
//   PROD_TEST_EMAILS                  comma-separated list of EXACTLY 4 emails
//                                     (coordinator, caregiver, supporter, aide)
//   SEED_PROD_TEST_CONFIRM_HOST       must equal the host of SUPABASE_URL
//                                     (catches "ran against the wrong project")
//   PROD_TEST_PASSWORD                optional; default 'CareSyncTest!123'
//
// Without SEED_PROD_TEST=1 the script prints what it WOULD do and exits 0
// without touching anything. Re-running is idempotent: accounts, the dedicated
// test org, and scenario content are keyed so no duplicates are created.
//
// All identities are SYNTHETIC — clearly-fake "Test Recipient A/B"; no real PHI.
//
//   Usage:
//     SEED_PROD_TEST=1 \
//     SUPABASE_URL=https://<ref>.supabase.co \
//     SUPABASE_SERVICE_ROLE_KEY=*** \
//     PROD_TEST_EMAILS=a@x.com,b@x.com,c@x.com,d@x.com \
//     SEED_PROD_TEST_CONFIRM_HOST=<ref>.supabase.co \
//     node scripts/seed-prod-test-accounts.mjs

import { createClient } from "@supabase/supabase-js";

const TEST_ORG_NAME = "E2E Test Org (synthetic — TD-219)";
const ROLES = ["coordinator", "caregiver", "supporter", "aide"];

function fail(msg) {
  console.error(`✗ ${msg}`);
  process.exit(1);
}

// ── Parse + validate guards ────────────────────────────────────────────────
// SUPABASE_URL must be set EXPLICITLY — no NEXT_PUBLIC_SUPABASE_URL fallback.
// An operator who merely sources apps/web/.env.local would otherwise resolve the
// prod URL silently, satisfy SEED_PROD_TEST_CONFIRM_HOST (host matches), and run a
// service-role write against a project they never consciously targeted. Forcing
// an explicit SUPABASE_URL keeps "never write to the wrong project by accident" real.
const url = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const emails = (process.env.PROD_TEST_EMAILS || "")
  .split(",")
  .map((e) => e.trim())
  .filter(Boolean);
const password = process.env.PROD_TEST_PASSWORD || "CareSyncTest!123";

if (!url) fail("SUPABASE_URL is required (set it explicitly — no env fallback).");
let host;
try {
  host = new URL(url).host;
} catch {
  fail(`SUPABASE_URL is not a valid URL: ${url}`);
}

if (emails.length !== 4) {
  fail(
    `PROD_TEST_EMAILS must list exactly 4 emails (coordinator,caregiver,supporter,aide); got ${emails.length}.`,
  );
}

// Dry-run / opt-in guard: print the plan and exit without writing.
if (process.env.SEED_PROD_TEST !== "1") {
  console.log("── seed-prod-test-accounts (DRY RUN) ──────────────────────────");
  console.log(`Target host : ${host}`);
  console.log(`Test org    : ${TEST_ORG_NAME}`);
  console.log(`Accounts    : ${emails.length} (${ROLES.join(", ")})`);
  console.log("");
  console.log("No changes made. To execute, set SEED_PROD_TEST=1 and");
  console.log(`SEED_PROD_TEST_CONFIRM_HOST=${host} (plus URL + service-role key).`);
  process.exit(0);
}

if (!serviceKey) fail("SUPABASE_SERVICE_ROLE_KEY is required (env only).");
if (process.env.SEED_PROD_TEST_CONFIRM_HOST !== host) {
  fail(
    `Refusing: SEED_PROD_TEST_CONFIRM_HOST must equal the target host "${host}" ` +
      `to confirm you're writing to the intended project.`,
  );
}

console.log("── seed-prod-test-accounts (LIVE) ─────────────────────────────");
console.log(`Target host : ${host}`);
console.log(`Test org    : ${TEST_ORG_NAME}`);
console.log(`Accounts    : ${emails.map((e) => e).join(", ")}`);
console.log("");

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ── Helpers ─────────────────────────────────────────────────────────────────

// Find a confirmed auth user by email (paginating listUsers), else create one.
async function ensureUser(email) {
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) fail(`listUsers failed: ${error.message}`);
    const found = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
    if (found) return found.id;
    if (data.users.length < 200) break; // last page
  }
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { display_name: email.split("@")[0] },
  });
  if (error) fail(`createUser failed for ${email}: ${error.message}`);
  return data.user.id;
}

async function ensureProfile(userId, email) {
  const { error } = await admin
    .from("user_profiles")
    .upsert(
      { id: userId, display_name: email.split("@")[0], email, onboarded: true },
      { onConflict: "id" },
    );
  if (error) fail(`user_profiles upsert failed for ${email}: ${error.message}`);
}

async function ensureTestOrg() {
  const { data: existing, error: selErr } = await admin
    .from("organizations")
    .select("id")
    .eq("name", TEST_ORG_NAME)
    .maybeSingle();
  if (selErr) fail(`organizations select failed: ${selErr.message}`);
  if (existing) return existing.id;
  const { data, error } = await admin
    .from("organizations")
    .insert({ name: TEST_ORG_NAME, org_type: "family", plan: "professional" })
    .select("id")
    .single();
  if (error) fail(`organizations insert failed: ${error.message}`);
  return data.id;
}

async function ensureRecipient(orgId, fullName, dob) {
  // Identity vault holds PHI; key the recipient on (org, full_name) to stay idempotent.
  const { data: vaultRows, error: vErr } = await admin
    .from("identity_vault")
    .select("token")
    .eq("org_id", orgId)
    .eq("full_name", fullName);
  if (vErr) fail(`identity_vault select failed: ${vErr.message}`);
  let token = vaultRows?.[0]?.token;
  if (!token) {
    const { data, error } = await admin
      .from("identity_vault")
      .insert({ org_id: orgId, full_name: fullName, dob, contact_info: {} })
      .select("token")
      .single();
    if (error) fail(`identity_vault insert failed: ${error.message}`);
    token = data.token;
  }
  const { data: recRows, error: rErr } = await admin
    .from("care_recipients")
    .select("id")
    .eq("identity_token", token);
  if (rErr) fail(`care_recipients select failed: ${rErr.message}`);
  if (recRows?.[0]) return recRows[0].id;
  const { data, error } = await admin
    .from("care_recipients")
    .insert({ org_id: orgId, identity_token: token })
    .select("id")
    .single();
  if (error) fail(`care_recipients insert failed: ${error.message}`);
  return data.id;
}

async function ensureMembership(orgId, userId, role, recipientId) {
  const { data: existing, error: selErr } = await admin
    .from("memberships")
    .select("id")
    .eq("org_id", orgId)
    .eq("user_id", userId)
    .eq("role", role)
    .maybeSingle();
  if (selErr) fail(`memberships select failed: ${selErr.message}`);
  if (existing) return;
  const { error } = await admin.from("memberships").insert({
    org_id: orgId,
    user_id: userId,
    role,
    recipient_id: recipientId ?? null,
    accepted_at: new Date().toISOString(),
  });
  if (error) fail(`memberships insert failed: ${error.message}`);
}

const daysAgo = (n) => new Date(Date.now() - n * 86400000).toISOString();
const daysAhead = (n) => new Date(Date.now() + n * 86400000).toISOString();

// ── Build the scenario ───────────────────────────────────────────────────────
const orgId = await ensureTestOrg();
console.log(`✓ test org ${orgId}`);

const userIds = {};
for (let i = 0; i < emails.length; i++) {
  const id = await ensureUser(emails[i]);
  await ensureProfile(id, emails[i]);
  userIds[ROLES[i]] = id;
  console.log(`✓ ${ROLES[i]}: ${emails[i]}`);
}

const recipA = await ensureRecipient(orgId, "Test Recipient A", "1939-04-12");
const recipB = await ensureRecipient(orgId, "Test Recipient B", "1945-11-03");
console.log(`✓ recipients ${recipA}, ${recipB}`);

await ensureMembership(orgId, userIds.coordinator, "coordinator", null);
await ensureMembership(orgId, userIds.caregiver, "caregiver", null);
await ensureMembership(orgId, userIds.supporter, "supporter", null);
await ensureMembership(orgId, userIds.aide, "aide", recipA);
console.log("✓ memberships (all accepted; aide scoped to Recipient A)");

// Content is inserted once: skip if this test org already has care_events.
const { count, error: cntErr } = await admin
  .from("care_events")
  .select("id", { count: "exact", head: true })
  .eq("org_id", orgId);
if (cntErr) fail(`care_events count failed: ${cntErr.message}`);
if ((count ?? 0) > 0) {
  console.log("✓ scenario content already present — nothing to add. Done.");
  process.exit(0);
}

const coord = userIds.coordinator;
const cg = userIds.caregiver;
const aide = userIds.aide;

const ins = async (table, rows) => {
  const { error } = await admin.from(table).insert(rows);
  if (error) fail(`${table} insert failed: ${error.message}`);
  console.log(`✓ ${table}: ${rows.length}`);
};

await ins("care_events", [
  { org_id: orgId, recipient_id: recipA, actor_id: cg, event_type: "journal", payload: { text: "Bright morning — finished the crossword.", mood: "good" }, occurred_at: daysAgo(18) },
  { org_id: orgId, recipient_id: recipA, actor_id: aide, event_type: "journal", payload: { text: "Quiet afternoon, short courtyard walk.", mood: "okay" }, occurred_at: daysAgo(12) },
  { org_id: orgId, recipient_id: recipA, actor_id: cg, event_type: "journal", flagged: true, payload: { text: "Confused about the date this morning — flagging for the team.", mood: "difficult" }, occurred_at: daysAgo(6) },
  { org_id: orgId, recipient_id: recipA, actor_id: aide, event_type: "journal", flagged: true, payload: { text: "Near-fall getting out of the tub — recommending a grab bar.", mood: "crisis" }, occurred_at: daysAgo(3) },
  { org_id: orgId, recipient_id: recipB, actor_id: cg, event_type: "journal", payload: { text: "Ankle swelling improved after diuretic adjustment.", mood: "okay" }, occurred_at: daysAgo(2) },
]);

await ins("medications", [
  { org_id: orgId, recipient_id: recipA, drug_name: "Metformin", brand_name: "Glucophage", dosage: "500 mg", form: "tablet", instructions: "Twice daily with meals.", active: true, refills_remaining: 2, supply_days_remaining: 24, last_refill_date: daysAgo(6).slice(0, 10) },
  { org_id: orgId, recipient_id: recipA, drug_name: "Donepezil", brand_name: "Aricept", dosage: "10 mg", form: "tablet", instructions: "Once at bedtime.", active: true, refills_remaining: 0, supply_days_remaining: 5, last_refill_date: daysAgo(25).slice(0, 10) },
  { org_id: orgId, recipient_id: recipB, drug_name: "Furosemide", brand_name: "Lasix", dosage: "40 mg", form: "tablet", instructions: "Once in the morning.", active: true, refills_remaining: 1, supply_days_remaining: 7, last_refill_date: daysAgo(23).slice(0, 10) },
]);

await ins("shifts", [
  { org_id: orgId, recipient_id: recipA, created_by: coord, assignee_user_id: cg, shift_type: "standard", status: "completed", start_at: daysAgo(2), end_at: daysAgo(2), notes: "Day shift — meals + meds." },
  { org_id: orgId, recipient_id: recipA, created_by: coord, assignee_user_id: aide, shift_type: "standard", status: "confirmed", start_at: daysAhead(1), end_at: daysAhead(1), notes: "Bath day — grab bar pending." },
  { org_id: orgId, recipient_id: recipA, created_by: coord, assignee_user_id: cg, shift_type: "on_call", status: "scheduled", start_at: daysAhead(2), end_at: daysAhead(3), notes: "Overnight on-call coverage." },
  { org_id: orgId, recipient_id: recipA, created_by: coord, shift_type: "standard", status: "open", start_at: daysAhead(4), end_at: daysAhead(4), notes: "Needs a volunteer." },
]);

await ins("tasks", [
  { org_id: orgId, recipient_id: recipA, created_by: coord, requested_by: coord, assigned_to: aide, status: "todo", title: "Install bathroom grab bar", instructions: "Per the fall-risk note.", due_at: daysAhead(1), checklist: [{ text: "Measure tub wall", done: true }, { text: "Buy ADA grab bar", done: false }, { text: "Mount + test", done: false }] },
  { org_id: orgId, recipient_id: recipA, created_by: coord, requested_by: coord, assigned_to: cg, status: "in_progress", title: "Pick up Donepezil refill", instructions: "Low supply — ~5 days left.", due_at: daysAhead(2), checklist: [{ text: "Call pharmacy", done: true }, { text: "Confirm insurance", done: false }] },
  { org_id: orgId, recipient_id: recipA, created_by: cg, requested_by: cg, assigned_to: cg, status: "done", title: "Schedule neurology follow-up", instructions: "Booked for next week.", due_at: daysAgo(1), checklist: [] },
  { org_id: orgId, recipient_id: recipB, created_by: coord, requested_by: coord, status: "cancelled", title: "Order compression socks", instructions: "Cancelled — physician advised against.", due_at: daysAgo(3), checklist: [] },
]);

await ins("documents", [
  { org_id: orgId, recipient_id: recipA, uploaded_by: coord, display_name: "Medicare card (front)", doc_type: "insurance_card", storage_path: "seed/recip-a/medicare-front.jpg", file_size: 184320 },
  { org_id: orgId, recipient_id: recipA, uploaded_by: coord, display_name: "Advance directive", doc_type: "advance_directive", storage_path: "seed/recip-a/advance-directive.pdf", file_size: 512000 },
]);

await ins("expenses", [
  { org_id: orgId, recipient_id: recipA, logged_by: coord, amount: 4200, category: "other", description: "Neurology copay", incurred_at: daysAgo(7) },
  { org_id: orgId, recipient_id: recipA, logged_by: cg, amount: 1875, category: "medication", description: "Metformin + Donepezil refill", incurred_at: daysAgo(6) },
  { org_id: orgId, recipient_id: recipA, logged_by: coord, amount: 3499, category: "home_modification", description: "ADA grab bar + mounting kit", incurred_at: daysAgo(2) },
]);

await ins("mood_entries", [
  { org_id: orgId, recipient_id: recipA, author_id: cg, mood: "good", note: "Cheerful and engaged.", occurred_at: daysAgo(18) },
  { org_id: orgId, recipient_id: recipA, author_id: aide, mood: "difficult", note: "Disoriented in the morning.", occurred_at: daysAgo(6) },
  { org_id: orgId, recipient_id: recipA, author_id: aide, mood: "crisis", note: "Near-fall in the bathroom.", occurred_at: daysAgo(3) },
]);

await ins("in_app_notifications", [
  { org_id: orgId, user_id: aide, recipient_id: recipA, type: "task_assigned", title: "New task assigned to you", body: "Install bathroom grab bar" },
  { org_id: orgId, user_id: coord, recipient_id: recipA, type: "task_completed", title: "Task completed", body: "Schedule neurology follow-up", read_at: daysAgo(1) },
]);

console.log("");
console.log("✓ Done — synthetic scenario populated for the prod test org.");
process.exit(0);
