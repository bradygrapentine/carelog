# Dev Data Seed Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create `supabase/dev_data.sql` — a rich QA dataset loadable against any running local Supabase instance.

**Architecture:** Single PL/pgSQL `DO $$` block. Declares all UUIDs up front, inserts in FK order. Idempotent via `ON CONFLICT DO NOTHING` / `DO UPDATE`. The `handle_new_user` trigger auto-creates `user_profiles` rows on auth.users insert; script then UPDATEs `display_name` and `onboarded=true`.

**Tech Stack:** PL/pgSQL, local Supabase (port 54322), `npx supabase db execute`

**Spec:** `docs/superpowers/specs/2026-04-14-dev-data-seed-design.md`

---

### Task 1: Write `supabase/dev_data.sql`

**Files:**
- Create: `supabase/dev_data.sql`

**Insert order (FK dependencies):**
1. `auth.users` (7 users) → triggers `user_profiles` auto-insert
2. UPDATE `user_profiles` display_name + onboarded
3. `organizations` (2)
4. `identity_vault` (3 tokens)
5. `care_recipients` (3)
6. `display_names` (3)
7. `memberships` (12 rows, all pre-accepted, `recipient_id = NULL` for org-wide)
8. `medications` (13) + `medication_schedules` (18)
9. `care_events` (42: ~14 per recipient across journal/medication/appointment/shift types)
10. `journal_reactions` (8 reactions on designated journal events)
11. `symptom_readings` (24: 10 Margaret, 10 Robert, 4 Dorothy)
12. `mood_entries` (20: 8 Margaret, 8 Robert, 4 Dorothy)
13. `shifts` (12: 6 Margaret, 4 Robert, 2 Dorothy)
14. `expenses` (15: 6 Margaret, 6 Robert, 3 Dorothy)
15. `outer_circle_requests` (4) + `outer_circle_claims` (3)
16. `burnout_checkins` (8: caregiver1 × 4 weeks, caregiver2 × 4 weeks)
17. `benefits_screenings` (2: one per Brady's org recipient)
18. `documents` (4: 2 per Brady's org recipient)
19. `eol_plans` (2: one per Brady's org recipient)
20. `care_briefs` (3: one per recipient)

**Users table:**

| Email | Display name | Password |
|---|---|---|
| brady.grapentine@gmail.com | Brady | password123 |
| gmkruege@gmail.com | Gail | password123 |
| brady.grapentine+coordinator@gmail.com | Sarah (Coordinator) | password123 |
| brady.grapentine+first-caregiver@gmail.com | Alex (Caregiver) | password123 |
| brady.grapentine+second-caregiver@gmail.com | Jordan (Caregiver) | password123 |
| brady.grapentine+supporter@gmail.com | Robin (Supporter) | password123 |
| brady.grapentine+aide@gmail.com | Taylor (Aide) | password123 |

**Memberships:**

| User | Brady's Family | Henderson Family |
|---|---|---|
| Brady | coordinator | coordinator |
| Gail | coordinator | coordinator |
| Sarah | coordinator | — |
| Alex | caregiver | — |
| Jordan | caregiver | caregiver |
| Robin | supporter | supporter |
| Taylor | aide | aide |

**Care recipients:**
- Margaret Thompson, DOB 1940-03-15, diagnoses: ["Type 2 Diabetes", "Hypertension"], allergies: ["Penicillin"]
- Robert Thompson, DOB 1938-07-22, diagnoses: ["Congestive Heart Failure", "Atrial Fibrillation"], allergies: ["Sulfa drugs", "NSAIDs"]
- Dorothy Henderson, DOB 1945-09-10, diagnoses: ["Hypothyroidism", "Osteoporosis"], allergies: []

**Medications:**

Margaret: Lisinopril 10mg (morning), Metformin 500mg (morning + evening), Atorvastatin 20mg (evening), Aspirin 81mg (morning), Amlodipine 5mg (morning)

Robert: Lisinopril 5mg (morning), Warfarin 5mg (evening), Furosemide 20mg (morning), Metoprolol 25mg (morning + evening), Omeprazole 20mg (morning)

Dorothy: Levothyroxine 50mcg (morning), Calcium 600mg (morning + evening), Vitamin D3 2000IU (morning)

**Care event payload shapes:**
- journal: `{"text": "..."}`
- medication: `{"drug_name": "...", "administered": true}`
- appointment: `{"title": "...", "location": "...", "notes": "..."}`
- shift: `{"summary": "..."}`

**Week stamps for burnout checkins:** 2026-W13, 2026-W14, 2026-W15, 2026-W16

- [ ] **Step 1: Write `supabase/dev_data.sql`**

  See full content below. Write this file exactly as specified.

- [ ] **Step 2: Run the script against local Supabase**

  ```sh
  npx supabase db execute --local < supabase/dev_data.sql
  ```
  Expected: no errors, script completes successfully.

- [ ] **Step 3: Verify row counts**

  ```sh
  npx supabase db execute --local << 'SQL'
  SELECT
    (SELECT count(*) FROM auth.users)             AS users,
    (SELECT count(*) FROM public.organizations)   AS orgs,
    (SELECT count(*) FROM public.care_recipients) AS recipients,
    (SELECT count(*) FROM public.memberships)     AS memberships,
    (SELECT count(*) FROM public.medications)     AS medications,
    (SELECT count(*) FROM public.care_events)     AS care_events,
    (SELECT count(*) FROM public.symptom_readings) AS symptom_readings,
    (SELECT count(*) FROM public.mood_entries)    AS mood_entries,
    (SELECT count(*) FROM public.expenses)        AS expenses;
  SQL
  ```
  Expected: users≥7, orgs=2, recipients=3, memberships=12, medications≥13, care_events≥42, symptom_readings≥24, mood_entries≥20, expenses≥15.

- [ ] **Step 4: Commit**

  ```sh
  git add supabase/dev_data.sql docs/superpowers/plans/2026-04-14-dev-data-seed.md docs/superpowers/specs/2026-04-14-dev-data-seed-design.md
  git commit -m "chore: add dev_data.sql QA seed with 7 users, 2 orgs, 3 recipients"
  ```
