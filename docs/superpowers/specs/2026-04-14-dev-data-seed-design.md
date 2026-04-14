# Dev Data Seed — Design Spec

**Date:** 2026-04-14  
**File:** `supabase/dev_data.sql`  
**Run with:** `psql postgresql://postgres:postgres@localhost:54322/postgres < supabase/dev_data.sql`

---

## Purpose

A standalone QA dataset that loads rich, realistic fake data into a running local Supabase instance. Does **not** run automatically on `db reset` (that's `seed.sql`). Idempotent: safe to re-run — all inserts use `ON CONFLICT DO NOTHING` or `ON CONFLICT DO UPDATE`.

---

## Users (7)

All passwords: `password123`

| Email | Role in Brady's Org | Role in Henderson Org |
|---|---|---|
| `brady.grapentine@gmail.com` | Coordinator (existing) | Coordinator |
| `gmkruege@gmail.com` | Coordinator | Coordinator |
| `brady.grapentine+coordinator@gmail.com` | Coordinator | — |
| `brady.grapentine+first-caregiver@gmail.com` | Caregiver | — |
| `brady.grapentine+second-caregiver@gmail.com` | Caregiver | Caregiver |
| `brady.grapentine+supporter@gmail.com` | Supporter | Supporter |
| `brady.grapentine+aide@gmail.com` | Aide | Aide |

---

## Organizations (2)

| Name | Plan | Notes |
|---|---|---|
| Brady's Family | professional | Existing from seed.sql |
| The Henderson Family | family | Second org for variety |

---

## Care Recipients

**Brady's Family (2):**
- Margaret Thompson, DOB 1940-03-15
- Robert Thompson, DOB 1938-07-22

**Henderson Family (1):**
- Dorothy Henderson, DOB 1945-09-10

---

## Data Per Recipient (Brady's Family — both recipients)

### Medications (5 per recipient)
- Lisinopril 10mg — 1x daily, morning
- Metformin 500mg — 2x daily, morning + evening
- Atorvastatin 20mg — 1x daily, evening
- Aspirin 81mg — 1x daily, morning
- Amlodipine 5mg — 1x daily, morning

### Care Events (~18 per recipient, spread over last 30 days)
Types: `journal` (8), `medication` (6), `shift` (2), `appointment` (2)
Mix of `human` and `system` entry kinds. 2 flagged entries per recipient.

### Symptom Readings (10 per recipient)
Spread over last 14 days. Varied: pain 2–7, mood good/okay/difficult, appetite normal/reduced, mobility normal/limited.

### Mood Entries (8 per recipient)
Spread over last 14 days. Mix of all 4 mood values. Some with notes, some without.

### Shifts (6 per recipient, across statuses)
- 2 open (future)
- 1 claimed (future, assigned to first-caregiver)
- 1 confirmed (future)
- 1 completed (past)
- 1 missed (past)

### Expenses (6 per recipient)
Categories: medication, supplies, transport, food, aide_hours, other. Amounts $12–$340.

### Outer Circle Requests (2 per recipient)
Types: meal, transport. One partially filled, one open.

### Burnout Check-ins
4 weeks of check-ins for each caregiver (first + second) in Brady's org. Scores varied 1–5.

### Benefits Screening (1 per recipient)
Simple answers/results JSON for coordinator reference.

### Documents (2 per recipient)
Types: power_of_attorney, advance_directive.

### EOL Plan (1 per recipient)
Full plan: healthcare proxy, DNR preference, funeral pref, legacy message.

### Care Brief (1 per recipient)
Shared snapshot. Not expired, not revoked.

### Journal Reactions
A mix of reactions (heart, grateful, thinking_of_you, strong) on journal events.

---

## Data for Henderson Family

Dorothy Henderson gets a lighter dataset: 3 medications, 6 care events, 4 symptom readings, 3 expenses, 1 care brief.

---

## Implementation Notes

- All inserts run as service role (seed context) — RLS bypassed
- `identity_vault` rows inserted before `care_recipients` (FK dependency)
- `display_names` populated for each recipient
- `memberships.accepted_at` set for all users (pre-accepted, no pending invites)
- Timestamps use `now() - interval 'N days'` for realistic spread
- Script is a single `DO $$ DECLARE ... BEGIN ... END $$` block, matching `seed.sql` style
