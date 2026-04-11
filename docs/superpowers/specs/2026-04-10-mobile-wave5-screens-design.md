# Mobile Wave 5 — Team, Symptoms, Burnout, Expenses, Documents

## Goal

Add 5 new mobile screens consuming existing tRPC backends. Two new bottom tabs: "Team" and "More" (hub for the other 4 features). Stepped wizard pattern for symptom and burnout entry. Amount-first expense log. Camera + file picker for document upload.

## Scope

**In scope:**
- Bottom tab bar: add Team tab + More tab (6 total)
- Team screen: member list, coordinator invite via `memberships.invite`
- Symptom tracker: history list + 4-step wizard via `symptoms.list` / `symptoms.log`
- Burnout check-in: history + 4-step wizard + coordinator summary via `burnout.checkIn` / `burnout.myHistory` / `burnout.orgSummary`
- Expense log: month-grouped list + amount-first add screen via `expenses.list` / `expenses.create` / `expenses.delete`
- Document vault: doc list + camera/file upload + tap-to-view via `documents.list` / `documents.delete` / `POST /api/documents/upload`
- Shared utility module with formatters and permission helpers
- Pure-logic unit tests

**Out of scope:**
- Web UI changes (handled by separate instance)
- New tRPC procedures or DB migrations
- Component render tests (Expo SDK instability)
- Receipt OCR for expenses (future)
- Offline queue for these screens (journal-only for now)

---

## Navigation

### Tab bar — 6 tabs

| Tab | Icon | Screen |
|-----|------|--------|
| Journal | book | `app/(app)/journal/index.tsx` (existing) |
| Medications | pill | `app/(app)/medications/index.tsx` (existing) |
| Schedule | calendar | `app/(app)/schedule/index.tsx` (existing) |
| Team | users | `app/(app)/team/index.tsx` (new) |
| More | grid | `app/(app)/more/index.tsx` (new) |
| Settings | gear | `app/(app)/settings/index.tsx` (existing) |

### More hub

Grid or list of 4 cards linking to:
- Symptoms → `app/(app)/symptoms/index.tsx`
- Burnout → `app/(app)/burnout/index.tsx`
- Expenses → `app/(app)/expenses/index.tsx`
- Documents → `app/(app)/documents/index.tsx`

---

## Screens

### 1. Team — `app/(app)/team/index.tsx`

**Data:** `trpc.memberships.list({ orgId })`

**UI:**
- FlatList of members: display name, role badge (coordinator/caregiver/aide/supporter), email
- Coordinator sees FAB (+) to invite
- Non-coordinators see list only

**Invite sheet** (coordinator only):
- Email text input
- Role picker: dropdown with 4 roles (coordinator, caregiver, aide, supporter)
- Send button → `trpc.memberships.invite({ orgId, email, role })`
- Success: toast + refetch list
- Error: inline error message

**Permissions:** All roles view. Coordinators invite.

---

### 2. Symptom Tracker

#### History — `app/(app)/symptoms/index.tsx`

**Data:** `trpc.symptoms.list({ recipientId })`

**UI:**
- FlatList, most recent first: date/time, pain level, mood badge, appetite, mobility
- Coordinator/caregiver sees "Log symptoms" button at top
- Supporters see read-only list

#### Wizard — `app/(app)/symptoms/log.tsx`

4-step wizard. Back arrow returns to previous step.

| Step | Field | Input |
|------|-------|-------|
| 1 | Pain (0-10) | Horizontal number row, tap to select |
| 2 | Mood | 4 buttons: good/okay/difficult/crisis (reuse `MOOD_COLORS` from `journalUtils.ts`) |
| 3 | Appetite + Mobility | Two pickers on one screen (both short enums) |
| 4 | Notes + Submit | Optional text input, submit button |

**Appetite options:** normal, reduced, poor, none
**Mobility options:** normal, limited, assisted, bedbound

Submit: `trpc.symptoms.log({ recipientId, painLevel, mood, appetite, mobility, notes })` → navigate back to history.

---

### 3. Burnout Check-in

#### History — `app/(app)/burnout/index.tsx`

**Data:** `trpc.burnout.myHistory()`

**UI:**
- List of last 12 weeks: week label (e.g. "Week of Apr 7"), sleep/stress/support scores, notes preview
- "Check in this week" button at top — disabled if current `week_stamp` already exists in history
- Coordinators see additional "Team summary" button

#### Wizard — `app/(app)/burnout/checkin.tsx`

4-step wizard.

| Step | Question | Input |
|------|----------|-------|
| 1 | "How's your sleep?" | Tap 1-5 scale |
| 2 | "How's your stress?" | Tap 1-5 scale |
| 3 | "Do you feel supported?" | Tap 1-5 scale |
| 4 | Notes + Submit | Optional text, submit button |

Submit: `trpc.burnout.checkIn({ sleep, stress, support, notes })` → navigate back to history.

#### Summary — `app/(app)/burnout/summary.tsx`

**Data:** `trpc.burnout.orgSummary()`

**UI:**
- Coordinator only
- Weekly averages for sleep/stress/support
- Only shows weeks with 3+ responses (anonymity threshold, enforced server-side)

---

### 4. Expense Log

#### List — `app/(app)/expenses/index.tsx`

**Data:** `trpc.expenses.list({ recipientId })`

**UI:**
- FlatList grouped by month, most recent first
- Each row: amount (bold), category badge, description, date
- Coordinator/caregiver sees FAB (+) to add
- Coordinator sees swipe-to-delete → confirm dialog → `trpc.expenses.delete({ id })`
- Supporters see read-only list

#### Add — `app/(app)/expenses/add.tsx`

Single screen, amount-first:

1. **Amount** — large numeric input at top, auto-formats with `$`
2. **Category** — horizontal scrollable chips: medication, supplies, equipment, home_modification, aide_hours, transport, food, other
3. **Description** — text input
4. **Date** — defaults to today, tappable to change (date picker)
5. **Submit**

Submit: `trpc.expenses.create({ recipientId, amount, category, description, incurredAt })` → navigate back to list.

---

### 5. Document Vault

#### List — `app/(app)/documents/index.tsx`

**Data:** `trpc.documents.list({ recipientId })`

**UI:**
- FlatList: display name, doc type badge (HIPAA authorization, POA, advance directive, insurance card, medication list, other), file size, upload date
- Tap → fetch `GET /api/documents/[id]/download` with Bearer auth header → response JSON contains `{ url: string }` (signed Supabase Storage URL, 180s expiry) → `Linking.openURL(url)` — PDFs open in system viewer, images in photo viewer
- Coordinator sees FAB (+) to upload and swipe-to-delete
- Other roles see read-only list with tap-to-view

#### Upload flow (coordinator only)

1. Tap "+" → action sheet: "Take photo" | "Choose file"
2. Camera: `expo-image-picker` camera mode
3. File: `expo-document-picker` (MIME allowlist: PDF, JPEG, PNG, HEIC; 10 MB limit)
4. Confirmation screen: filename preview, doc type picker (6 options), "Upload" button
5. Upload: multipart form POST to `/api/documents/upload` with Bearer auth
6. Success: refetch list, navigate back

**Delete:** coordinator swipe → confirm dialog → `trpc.documents.delete({ id })`.

---

## Shared Utilities

### `apps/mobile/utils/wave5Utils.ts`

```ts
// --- Types ---
type ExpenseCategory = 'medication' | 'supplies' | 'equipment' | 'home_modification' | 'aide_hours' | 'transport' | 'food' | 'other'
type DocType = 'hipaa_authorization' | 'power_of_attorney' | 'advance_directive' | 'insurance_card' | 'medication_list' | 'other'
type Appetite = 'normal' | 'reduced' | 'poor' | 'none'
type Mobility = 'normal' | 'limited' | 'assisted' | 'bedbound'

// --- Constants ---
const EXPENSE_CATEGORIES: { key: ExpenseCategory; label: string }[]
const DOC_TYPES: { key: DocType; label: string }[]
const APPETITE_OPTIONS: { key: Appetite; label: string }[]
const MOBILITY_OPTIONS: { key: Mobility; label: string }[]

// --- Formatters ---
function formatCurrency(amount: number): string
  // e.g. 42.5 → "$42.50"

function formatWeekStamp(stamp: string): string
  // e.g. "2026-W15" → "Week of Apr 6"

function formatFileSize(bytes: number): string
  // e.g. 1048576 → "1.0 MB", 512 → "512 B", 2048 → "2.0 KB"

// --- Permission helpers ---
function canInvite(role: string | null): boolean
  // coordinator only

function canLogSymptoms(role: string | null): boolean
  // coordinator or caregiver

function canLogExpense(role: string | null): boolean
  // coordinator or caregiver

function canUploadDocument(role: string | null): boolean
  // coordinator only

function canDeleteExpense(role: string | null): boolean
  // coordinator only
```

---

## Testing

### `apps/mobile/__tests__/wave5Utils.test.ts`

Pure-logic tests only. No component rendering.

| Test | Assertion |
|------|-----------|
| `formatCurrency` formats whole numbers | `formatCurrency(42)` → `"$42.00"` |
| `formatCurrency` formats decimals | `formatCurrency(42.5)` → `"$42.50"` |
| `formatCurrency` formats zero | `formatCurrency(0)` → `"$0.00"` |
| `formatWeekStamp` parses ISO week | `formatWeekStamp("2026-W15")` → contains "Apr" |
| `formatFileSize` formats bytes | `formatFileSize(512)` → `"512 B"` |
| `formatFileSize` formats KB | `formatFileSize(2048)` → `"2.0 KB"` |
| `formatFileSize` formats MB | `formatFileSize(1048576)` → `"1.0 MB"` |
| `canInvite` coordinator = true | `canInvite('coordinator')` → `true` |
| `canInvite` caregiver = false | `canInvite('caregiver')` → `false` |
| `canInvite` null = false | `canInvite(null)` → `false` |
| `canLogSymptoms` coordinator = true | `canLogSymptoms('coordinator')` → `true` |
| `canLogSymptoms` caregiver = true | `canLogSymptoms('caregiver')` → `true` |
| `canLogSymptoms` supporter = false | `canLogSymptoms('supporter')` → `false` |
| `canLogExpense` coordinator = true | `canLogExpense('coordinator')` → `true` |
| `canLogExpense` caregiver = true | `canLogExpense('caregiver')` → `true` |
| `canLogExpense` supporter = false | `canLogExpense('supporter')` → `false` |
| `canUploadDocument` coordinator = true | `canUploadDocument('coordinator')` → `true` |
| `canUploadDocument` caregiver = false | `canUploadDocument('caregiver')` → `false` |
| `canDeleteExpense` coordinator = true | `canDeleteExpense('coordinator')` → `true` |
| `canDeleteExpense` caregiver = false | `canDeleteExpense('caregiver')` → `false` |
| `EXPENSE_CATEGORIES` has 8 items | length check |
| `DOC_TYPES` has 6 items | length check |
| `APPETITE_OPTIONS` has 4 items | length check |
| `MOBILITY_OPTIONS` has 4 items | length check |

---

## Dependencies

All tRPC routers and DB tables already exist. No new backend work required.

**New Expo packages needed:**
- `expo-image-picker` — camera capture for document upload
- `expo-document-picker` — file selection for document upload

Both are standard Expo SDK 55 packages, no native module conflicts expected.

---

## File Map

| Action | Path |
|--------|------|
| Modify | `app/(app)/_layout.tsx` — add Team + More tabs |
| Create | `app/(app)/team/index.tsx` |
| Create | `app/(app)/more/index.tsx` |
| Create | `app/(app)/symptoms/index.tsx` |
| Create | `app/(app)/symptoms/log.tsx` |
| Create | `app/(app)/burnout/index.tsx` |
| Create | `app/(app)/burnout/checkin.tsx` |
| Create | `app/(app)/burnout/summary.tsx` |
| Create | `app/(app)/expenses/index.tsx` |
| Create | `app/(app)/expenses/add.tsx` |
| Create | `app/(app)/documents/index.tsx` |
| Create | `utils/wave5Utils.ts` |
| Create | `__tests__/wave5Utils.test.ts` |
