# Carelog — Manual Testing Runbook

QA testing guide for the live web app. Run through each section after deploys or before releases. Mobile sections note where native behavior differs.

---

## Setup

### Prerequisites

- Live production URL: `https://care-log.org`
- Two test email accounts (coordinator + supporter)
- A mobile device or browser DevTools → mobile emulation for mobile sections
- Access to Supabase dashboard (to inspect rows if needed)

### Test accounts

Create fresh accounts for each session to avoid stale state. Use `+tag` email aliases if your email provider supports them:

- `you+coord@example.com` — coordinator role
- `you+support@example.com` — supporter role

---

## 1. Auth

### 1a. OTP Sign-in (web)

1. Go to `https://care-log.org`
2. Enter `you+coord@example.com` → click **Send code**
3. Check email — OTP should arrive within 10 seconds
4. Enter the 6-digit code
5. **Expect:** redirected to `/dashboard`

### 1b. Session persistence

1. Sign in (step 1a)
2. Hard-reload the page (`Cmd+Shift+R` / `Ctrl+Shift+R`)
3. **Expect:** still signed in, dashboard loads

### 1c. Sign out

1. Sign in
2. Click **Sign out**
3. **Expect:** redirected to sign-in page, session cleared

### 1d. Expired OTP

1. Request a code but wait 11+ minutes before entering it
2. **Expect:** error message, not signed in

---

## 2. Onboarding

### 2a. First-time setup

1. Sign in with a brand-new email
2. **Expect:** redirected to onboarding flow (if not already in an org)
3. Complete org setup — enter a care recipient name
4. **Expect:** redirected to `/dashboard`, care team panel shows the new org

---

## 3. Care Journal

### 3a. Create an entry (coordinator)

1. Sign in as coordinator → go to `/journal`
2. Click the entry input
3. **Expect:** writing prompts appear (3 prompts, randomly selected)
4. Tap a prompt — it should fill the text field
5. Select a mood tag: **Good / Okay / Difficult / Crisis**
6. Submit
7. **Expect:** entry appears in the timeline immediately (optimistic UI)

### 3b. Entry detail view

1. Click an entry in the timeline
2. **Expect:** full entry text, mood tag, flag status, reactions displayed

### 3c. Flag for doctor (coordinator)

1. Open an entry
2. Click **Flag for doctor**
3. **Expect:** entry shows flagged indicator; flag persists on reload

### 3d. Flag blocked for supporters

1. Sign in as supporter → open an entry
2. **Expect:** Flag for doctor button absent or disabled

### 3e. Supporter reactions

1. Sign in as supporter → open an entry
2. Click a reaction (heart / thinking of you / strong / grateful)
3. **Expect:** reaction count increments immediately (optimistic UI)
4. Click the same reaction again
5. **Expect:** reaction toggles off (count decrements)

### 3f. Role-based write access

1. Sign in as supporter → go to `/journal`
2. **Expect:** entry form is read-only or absent — supporters cannot post entries

---

## 4. Team Management

### 4a. Invite a new user

1. Sign in as coordinator → go to `/journal`
2. Open the Team panel
3. Enter `you+support@example.com` + select role **Supporter** → click **Invite**
4. **Expect:** invite sent, pending member appears in Team panel

### 4b. Accept an invite

1. Check `you+support@example.com` inbox — invite email should arrive
2. Click the invite link
3. **Expect:** `/invite/[token]` page loads showing org name and role
4. Click **Accept** (sign in if prompted)
5. **Expect:** redirected to dashboard, now a member of the org

### 4c. Duplicate invite blocked

1. Try to accept the same invite link a second time
2. **Expect:** error or "already accepted" state — token is consumed

### 4d. Team panel shows members

> **KNOWN GAP — do not use as a release blocker.**
> The `/api/members` endpoint resolves display names, but historical UI wiring sometimes renders `"Team member"` or a raw UUID instead of the real name. If this reproduces, treat it as a regression and open a new `TD-*` row in `BACKLOG.md`.

1. Sign in as coordinator → Team panel
2. **Expect:** accepted members appear in the panel with role badges
3. **Note:** display names may show as `"Team member"` or a UUID — this is the current known behavior, not a bug to block on

---

## 5. Scheduler (Phase 2)

### 5a. Create a shift

1. Sign in as coordinator → navigate to the scheduler section
2. Create a new shift: assignee, date, start/end time
3. **Expect:** shift appears in the shift list

### 5b. Recurring shift

1. Create a shift with "Repeat weekly for N weeks" enabled
2. **Expect:** N entries appear in the shift list

### 5c. Cancel a series

1. Cancel one shift from a recurring series
2. **Expect:** only that shift removed, not the whole series (unless "cancel series" selected)

---

## 6. Medications (Phase 3)

### 6a. Add a medication

1. Sign in as coordinator → Medications panel
2. Add a medication: name, dose, schedule
3. **Expect:** medication appears in the catalog

### 6b. Log administration

1. Open the medication checklist for today
2. Mark a medication as administered
3. **Expect:** logged, timestamp shown

### 6c. OCR prescription scan

1. Click the OCR upload button
2. Upload a photo of a prescription label (or a sample image)
3. **Expect:** OCR review panel opens with parsed fields (name, dose, refill date)
4. Confirm or edit the fields → save
5. **Expect:** medication added to the catalog

---

## 7. Outer Circle (Phase 3)

### 7a. Post a volunteer request

1. Sign in as coordinator → Outer Circle panel
2. Create a volunteer request: task, slots available
3. **Expect:** request appears on the board with share link

### 7b. Public volunteer claim (no account required)

1. Copy the share link from the request
2. Open in an incognito window (not signed in)
3. **Expect:** public `/care/[token]` page loads showing the request
4. Click **Claim**
5. **Expect:** slot decrements; if last slot, link shows "full"

### 7c. Slot capacity enforced

1. Fill all slots on a request
2. Try to claim again
3. **Expect:** 409 conflict — "no slots available"

---

## 8. Care Brief (Phase 3)

### 8a. Generate a brief

1. Sign in as coordinator → Care Brief section
2. Click **Generate Brief**
3. **Expect:** brief generated, shareable link created

### 8b. View the brief (public)

1. Open the brief link in incognito
2. **Expect:** public `/brief/[token]` page loads with care summary

### 8c. Revoke a brief

1. Click **Revoke** on an active brief
2. Try to open the revoked link
3. **Expect:** 404 or "brief no longer available"

---

## 9. Background Jobs

### 9a. Weekly digest

1. In Inngest dashboard → Functions → `weekly-digest` → **Invoke**
2. **Expect:** email arrives for the coordinator account within 2 minutes
3. Email should include: journal summary, shift schedule for the week, any flagged entries

### 9b. Refill alert

1. Add a medication with a refill date within 7 days
2. In Inngest dashboard → trigger `refill-alert` manually
3. **Expect:** alert notification or email sent to coordinator

---

## 10. Rate Limiting

### 10a. OTP rate limit

1. Request 6 OTPs in rapid succession for the same email
2. **Expect:** 6th request returns 429 Too Many Requests

---

## 11. Mobile (Web — Responsive)

Test at 390×844 (iPhone 14 viewport) via DevTools.

- [ ] Sign-in page renders correctly
- [ ] Journal timeline is scrollable, entries are readable
- [ ] Entry form is tappable, keyboard does not obscure input
- [ ] Team panel opens and scrolls
- [ ] Mood tag selector is tappable with finger-sized targets
- [ ] Reactions are tappable

---

## 12. Error Tracking (Sentry)

1. In Sentry dashboard, confirm no new errors appeared after a testing session
2. If a test deliberately triggers an error, verify it appears in Sentry with no PHI attached (UUIDs only, no real names)
