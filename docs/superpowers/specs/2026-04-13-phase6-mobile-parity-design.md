# Phase 6 — Mobile Full-Write Parity

**Date:** 2026-04-13
**Status:** Approved for implementation planning
**Approach:** Navigation-first, then 5 parallel feature agents

---

## Context

Phases 1–5 are shipped and deployed. The web app has full feature coverage across scheduling, medical, retention, finances, and documents. The mobile app (Expo SDK 55, Expo Router) currently covers:

- Journal (read + write, offline-first)
- Medications checklist (today's doses, mark as given)
- Schedule (next 7 days)
- Settings (push notifications, sign out)
- Push notifications (journal flags, gap alerts, burnout alerts)
- Apple Watch (med quick-log, mood pulse)

**Goal:** Bring all web Phase 3–5 features to mobile with full write capability for all roles.

---

## Navigation Architecture

### Current tabs → Restructured tabs

| Tab | Before | After |
|-----|--------|-------|
| 1 | Journal | Journal (unchanged) |
| 2 | Medications | Health (Medications + Symptoms + Burnout + OCR scan) |
| 3 | Schedule | Schedule (unchanged) |
| 4 | Settings | Care (Expenses + Documents + Outer Circle + Care Brief) |
| 5 | — | Settings (existing + Benefits + EOL Planner for coordinators) |

### Route structure (`apps/mobile/app/(tabs)/`)

```
(tabs)/
  journal/
    index.tsx          ← existing
  health/
    index.tsx          ← Medications checklist (moved from tabs root)
    symptoms.tsx       ← NEW
    burnout.tsx        ← NEW
    ocr-scan.tsx       ← NEW
  schedule/
    index.tsx          ← existing
  care/
    index.tsx          ← Expenses list (default care screen)
    expenses.tsx       ← NEW
    documents.tsx      ← NEW
    outer-circle.tsx   ← NEW
    care-brief.tsx     ← NEW
  settings/
    index.tsx          ← existing
    benefits.tsx       ← NEW (coordinator only)
    eol-planner.tsx    ← NEW (coordinator only)
```

### Foundation agent deliverables
- Restructure `(tabs)/_layout.tsx` — 5 tabs with icons
- Create all placeholder screens (renders `<Text>Coming soon</Text>`)
- Update TypeScript route types if using typed routes
- Move Medications screen into `health/index.tsx`, update all existing imports
- No feature logic — mounting points only

---

## Feature Clusters

### Cluster 1 — Health (`apps/mobile/app/(tabs)/health/`)

**symptoms.tsx**
- List: `trpc.symptoms.list` scoped to current recipient
- Quick-log form: type (dropdown), value (numeric), severity (1–5 slider), notes (optional)
- Mutation: `trpc.symptoms.log`
- Role guard: coordinator + caregiver write; supporter read-only

**burnout.tsx**
- Weekly check-in form: sleep score, stress score, support score (each 1–10)
- Idempotent submit — disabled if already submitted this week (same UNIQUE constraint as web)
- History list: last 4 check-ins
- Mutation: `trpc.burnout.checkIn`
- Role guard: any authenticated member can submit their own

**ocr-scan.tsx**
- Camera capture via `expo-camera` or `expo-image-picker`
- POST to `/api/ocr/upload` (multipart, same endpoint as web)
- Polling `trpc.ocr.getJob` until status = `needs_review`
- Review form: prefilled name, dosage, frequency — editable before confirm
- Confirm: POST `/api/ocr/save-fields` → creates medication row
- Coordinator only

---

### Cluster 2 — Expenses (`apps/mobile/app/(tabs)/care/expenses.tsx`)

- Expense list: `trpc.expenses.list`, sorted by date desc
- Add expense sheet (bottom sheet): amount (numeric), category (picker), date (date picker), notes (optional), receipt photo (optional — image picker → upload)
- Mutation: `trpc.expenses.add`
- All org members can add and view

---

### Cluster 3 — Documents (`apps/mobile/app/(tabs)/care/documents.tsx`)

- Document list: `trpc.documents.list`
- Download: fetch signed URL → `Linking.openURL()` (opens in system browser/viewer)
- Upload: `expo-image-picker` or file picker → multipart POST `/api/documents/upload`
  - Display name input before upload
  - MIME allowlist enforced server-side (PDF/JPEG/PNG/HEIC), 10 MB limit
- Coordinator-only: upload button, delete button
- All members: read + download

---

### Cluster 4 — Coordination (`apps/mobile/app/(tabs)/care/`)

**outer-circle.tsx** (coordinator only for management; public claim flow stays web)
- List coordinator's requests: `trpc.outerCircle.list`
- Create request: title, description, slots total
- View claims per request
- Non-coordinators: empty state with explanation

**care-brief.tsx** (coordinator only)
- Generate brief button → POST `/api/brief`
- On success: show shareable URL + copy-to-clipboard button
- List existing briefs with revoke action
- Non-coordinators: read-only view of active briefs

---

### Cluster 5 — Coordinator Tools (within Settings tab)

**benefits.tsx**
- Eligibility screening form (same 5-program questions as web)
- Results: eligible programs with descriptions and links
- `trpc.benefits.screen` mutation
- Coordinator only

**eol-planner.tsx**
- Read/edit advance directive fields (same fields as web `EolPlanner.tsx`)
- Links to document vault for attached directives
- `trpc.eolPlan.get` + `trpc.eolPlan.upsert`
- Coordinator only — invisible to other roles

---

## TDD Test Skeletons

Each cluster agent writes Jest test skeletons (React Native Testing Library) alongside implementation:

```
apps/mobile/__tests__/
  health/
    symptoms.test.tsx
    burnout.test.tsx
    ocr-scan.test.tsx
  care/
    expenses.test.tsx
    documents.test.tsx
    outer-circle.test.tsx
    care-brief.test.tsx
  settings/
    benefits.test.tsx
    eol-planner.test.tsx
```

Each skeleton covers:
- Screen renders without crash (mock tRPC)
- Role guard: coordinator-only screens show empty/locked state for non-coordinators
- Happy path: form submit calls correct mutation with correct args
- Error state: mutation failure shows error message
- Empty state: list with no data shows correct empty UI

---

## Implementation Sequence

```
Step 0: Navigation foundation agent (sequential — must complete first)
         └── Restructure tabs, create placeholder screens, move Medications

Step 1 (parallel — all after Step 0):
  Agent A: Health cluster (symptoms + burnout + OCR scan)
  Agent B: Expenses cluster
  Agent C: Documents cluster
  Agent D: Coordination cluster (outer circle + care brief)
  Agent E: Coordinator tools (benefits + EOL planner)

Step 2: Integration pass — verify tab nav, deep links, push notification routing
Step 3: E2E mobile test pass (Maestro or manual QA checklist)
```

---

## Role Enforcement Matrix

| Feature | Coordinator | Caregiver | Supporter |
|---------|-------------|-----------|-----------|
| Symptoms log | Write | Write | Read |
| Burnout check-in | Write (own) | Write (own) | — |
| OCR prescription scan | Write | — | — |
| Expenses | Write | Write | Read |
| Documents | Upload + Delete | Read + Download | Read + Download |
| Outer Circle mgmt | Write | — | — |
| Care Brief | Generate + Revoke | — | — |
| Benefits navigator | Write | — | — |
| EOL Planner | Write | — | Invisible |

---

## Constraints

- No `any` types
- No template literals in JSX props (ENTERPRISE_PRINCIPLES)
- Read all form values before any `await` in mutation handlers
- `expo-camera` and `expo-image-picker` already in package.json — verify before adding
- All new tRPC calls use existing web procedures — no new server-side routers needed
- Offline queue (`useOfflineWrite`) wired for symptom logs and expense adds (high-frequency write operations)
- Role checks mirror web: `membership.role` from org context

---

## Definition of Done

- [ ] All 5 tab icons render correctly on iOS simulator
- [ ] Each feature works end-to-end against local Supabase
- [ ] Role enforcement verified for each feature (wrong role sees locked/empty state)
- [ ] Jest skeletons exist for all 9 new screens
- [ ] No TypeScript errors (`pnpm typecheck`)
- [ ] No ESLint violations
- [ ] BUILD_STATUS.md Wave 4 section added and checked
