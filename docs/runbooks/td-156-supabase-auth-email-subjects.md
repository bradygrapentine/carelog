# TD-156 — Standardize Supabase Auth email subjects

**Surface:** Supabase Dashboard → Auth → Email Templates.
**Why:** new users get `"Confirm Your Signup"` while existing users get `"Your Magic Link"` (surfaced 2026-05-17 by Cowork auth-unhappy suite run `1778990299` scenario 4). Subject-line divergence = email-template-based user enumeration even though the UI string ("Check your email…") is identical. Practical exploit value is near zero (mailbox access = full compromise anyway), but standardizing the subjects closes a clean threat-model gap.
**Risk:** LOW. **Size:** XS (~10 min — no code, no migration, no deploy).
**Owner action only:** Claude cannot click Supabase Dashboard.

## Prereqs

- [ ] Logged into the Supabase Dashboard as a project owner ([project link](https://supabase.com/dashboard/project/_/auth/templates) — replace `_` with the carelog project id)
- [ ] Confirmed today's date is **2026-05-17** or later (no other auth template work in flight)

> Note: changes to email templates take effect immediately for new emails dispatched after save. No restart, no deploy, no cache invalidation needed.

## Steps

### 1. Open the auth templates page

- [ ] Navigate: **Supabase Dashboard → carelog project → Authentication → Email Templates**

  [Open Auth → Email Templates](https://supabase.com/dashboard/project/_/auth/templates)

### 2. Update "Confirm Signup" template

- [ ] Click the **Confirm Signup** template tab
- [ ] Find the **Subject heading** field
- [ ] Current value (expected): `Confirm Your Signup` (Supabase default)
- [ ] **Set to:** `Your CareSync sign-in code`
- [ ] Body stays unchanged. Do NOT edit the HTML body — that's a separate UX-* row.
- [ ] Click **Save changes**

### 3. Update "Magic Link" template

- [ ] Click the **Magic Link** template tab
- [ ] Find the **Subject heading** field
- [ ] Current value (expected): `Your Magic Link` (Supabase default)
- [ ] **Set to:** `Your CareSync sign-in code`  ← same as step 2
- [ ] Click **Save changes**

### 4. Verify

Two routes to confirm:

- [ ] **Route A — trigger a real email.** From a logged-out browser session, hit the sign-in page, request a code for a brand-new email address (not in `auth.users`), then request a code for an existing user (`brady.grapentine@gmail.com`). Both inbound emails should now have the subject `Your CareSync sign-in code`.

  ```bash
  # Confirm in Resend logs that both emails dispatched
  # https://resend.com/emails
  ```

  > Watch: Supabase rate-limits OTP requests at 1 per 60 seconds per email. Use two different emails OR wait 60s between requests.

- [ ] **Route B — query Resend logs directly.** [Resend dashboard → Emails](https://resend.com/emails) — filter by Subject containing "CareSync sign-in code". Both signup-flow and magic-link-flow rows should appear with the new subject.

### 5. Update BACKLOG.md

After Steps 1–4 are checked, the row in `BACKLOG.md` (`TD-156`) needs to flip to shipped. **Do NOT edit BACKLOG.md directly** per ADR-0002 — open a dedicated `chore(backlog):` PR that moves the row to §7 with one-line shipped summary:

```
- 2026-05-17 TD-156 — Standardized Supabase Auth email subjects to "Your CareSync sign-in code" for both confirm-signup and magic-link templates. Closes the email-template enumeration vector surfaced by Cowork auth-unhappy suite run 1778990299. Dashboard-only change; no PR.
```

> Tip: ask Claude — "open a chore(backlog) PR closing TD-156 with the line above" — and he'll do it.

## Rollback

If the new subject causes inbox-filter rules to break for someone, revert each template's subject to its original Supabase default in the dashboard. Effect is immediate.

## Out of scope

- HTML body changes (separate UX-* row if needed)
- DKIM/DMARC sender domain changes (TD-151)
- Resend integration changes (working as of 2026-05-15)
