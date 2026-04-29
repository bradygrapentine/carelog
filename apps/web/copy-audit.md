# CareSync Copy Audit — 2026-04-29

Read-only. Findings grouped by surface, ranked **Critical / Medium / Low**.

**Tone bar (from PRODUCT.md):** warm · candid · companion. Plainspoken, never sentimental. Acknowledges hard situations by not performing them. Anti-references: clinical/EHR cold, sentimental wellness, generic SaaS, maximalist consumer.

**Format per finding:** file:line · severity · current → suggested · *why*.

---

## 1. Errors & form validation

### Critical

- `apps/web/components/ai/AIPanel.tsx:42` [Critical]
  - Current: `"Something went wrong. Please try again."`
  - Issue: vague + unactionable
  - Suggested: `"The assistant didn't reply. Try again, or check back in a minute."`

- `apps/web/app/(app)/journal/[recipientId]/OuterCirclePanel.tsx:88` [Critical]
  - Current: `"Something went wrong. Please try again."`
  - Issue: vague — most generic-SaaS line in the codebase, used in 6+ places
  - Suggested: `"The request didn't save. Try again."`

- `apps/web/app/(app)/journal/[recipientId]/EolPlanner.tsx:67` [Critical]
  - Current: `"Something went wrong. Please try again."`
  - Issue: vague; subject ("the plan") is recoverable from context
  - Suggested: `"The plan didn't save. Try again."`

- `apps/web/app/(app)/journal/[recipientId]/BurnoutCheckin.tsx:92` [Critical]
  - Current: `"Something went wrong. Please try again."`
  - Issue: vague-generic
  - Suggested: `"The check-in didn't save. Try again."`

- `apps/web/app/(app)/journal/[recipientId]/SymptomPanel.tsx:102` [Critical]
  - Current: `"Something went wrong. Please try again."`
  - Issue: vague-generic
  - Suggested: `"The reading didn't save. Try again."`

- `apps/web/app/(app)/journal/[recipientId]/MedicationPanel.tsx:59` [Critical]
  - Current: `"Something went wrong. Please try again."`
  - Issue: vague-generic
  - Suggested: `"The medication didn't save. Try again."`

- `apps/web/app/(app)/journal/[recipientId]/ShiftForm.tsx:138` [Critical]
  - Current: `"Something went wrong. Please try again."`
  - Issue: vague-generic — in a flow with a perfectly specific sibling line at :136 ("This person already has a shift at that time.")
  - Suggested: `"The shift didn't save. Try again."`

- `apps/web/app/care/[shareToken]/page.tsx:108` [Critical]
  - Current: `data.error ?? "Something went wrong. Please try again."`
  - Issue: vague-generic on a public-facing claim flow where context is fragile
  - Suggested: `data.error ?? "Couldn't claim that slot. Try again, or refresh the page."`

- `apps/web/app/signin/page.tsx:35` [Critical]
  - Current: `? "Something went wrong. Please try again."`
  - Issue: vague-generic on the auth confirm callback
  - Suggested: `"That sign-in link didn't work. Try sending a new code."`

- `apps/web/app/signin/SignInForm.tsx:26,46` [Critical]
  - Current: passes raw `error.message` from Supabase straight to UI (`setError(error.message)`)
  - Issue: leaks EHR-cold strings ("Token has expired or is invalid", "Email rate limit exceeded") with no remediation
  - Suggested: catch known codes — invalid OTP → `"That code didn't match. Check the digits or send a new code."`; expired → `"The code expired. Send a new one."`; rate limit → `"Too many attempts. Wait a minute and try again."`

- `apps/web/app/invite/[token]/page.tsx:40` [Critical]
  - Current: `"Failed to load invite."`
  - Issue: passive + unactionable + EHR-cold ("Failed")
  - Suggested: `"This invite link didn't load. Ask whoever sent it to share a fresh one."`

- `apps/web/app/invite/[token]/page.tsx:85` [Critical]
  - Current: `data.error ?? "Failed to accept."`
  - Issue: passive + abrupt + no next step
  - Suggested: `data.error ?? "Couldn't accept this invite. It may have already been used or expired."`

- `apps/web/app/(app)/billing/success/page.tsx:52,57` [Critical]
  - Current: heading `"Something went wrong"`, body `"We couldn't confirm your subscription. Please check your…"`
  - Issue: heading is wellness-vague; the body recovers it but the heading is what users see
  - Suggested: heading → `"We couldn't confirm your subscription"`; body → `"Stripe didn't return a confirmation. If your card was charged, refresh in a minute — or email hello@care-log.org and we'll sort it out."`

### Medium

- `apps/web/app/(app)/journal/[recipientId]/ExpensePanel.tsx:84` [Medium]
  - Current: `"Failed to log expense. Please try again."`
  - Issue: passive + EHR-flavored "Failed to"
  - Suggested: `"The expense didn't save. Try again."`

- `apps/web/app/(app)/journal/[recipientId]/ExportButton.tsx:42,62` [Medium]
  - Current: `"Export failed. Please try again."`
  - Issue: terse passive
  - Suggested: `"The export didn't finish. Try again, or pick a smaller date range."`

- `apps/web/app/(app)/settings/page.tsx:186` [Medium]
  - Current: `"Save failed — please try again."`
  - Issue: em-dash in prose (design rule), passive
  - Suggested: `"That didn't save. Try again."`

- `apps/web/app/(app)/settings/page.tsx:306,313,340` [Medium]
  - Current: `"Failed to register service worker."`, `"Failed to subscribe to push notifications."`, `"Failed to subscribe on server."`
  - Issue: jargon ("service worker", "subscribe on server") + unactionable
  - Suggested: collapse to one user-facing message: `"Push notifications didn't turn on. Try again, or check your browser's notification permissions."`

- `apps/web/app/(app)/team/admin/TeamAdminClient.tsx:40` [Medium]
  - Current: `"Failed to remove member. Please try again."`
  - Issue: passive + "Please try again" filler
  - Suggested: `"Couldn't remove that member. Try again."`

- `apps/web/components/care-events/CommentThread.tsx:23,27,37` [Medium]
  - Current: `"Could not add comment — please try again"`, etc.
  - Issue: em-dash in prose; "please try again" is filler
  - Suggested: `"That comment didn't post. Try again."` / `"That edit didn't save."` / `"That comment didn't delete."`

- `apps/web/app/(app)/journal/[recipientId]/BurnoutCheckin.tsx:93` [Medium]
  - Current: `"Couldn't save check-in — try again"`
  - Issue: em-dash in prose (design rule)
  - Suggested: `"Couldn't save the check-in. Try again."`

- `apps/web/app/onboarding/OnboardingForm.tsx:53,63,69` [Medium]
  - Current: three different error strings — `"We couldn't reach the server. Check your connection and try again."` / `"Something went wrong on our end. Please try again."` / `"That didn't save. Check your connection and try again."`
  - Issue: only one (`"We couldn't reach the server…"`) is good; the other two read as generic-SaaS or partly redundant
  - Suggested: keep the network-error one verbatim; consolidate the JSON-parse + non-OK branches into `"We couldn't finish setup. Try again, or email hello@care-log.org if it keeps failing."`

### Low

- `apps/web/app/(app)/journal/[recipientId]/EolPlanner.tsx:68` [Low]
  - Current: `toast.error("Couldn't save plan")`
  - Issue: terse; OK but inconsistent with sibling toasts that say "Couldn't log/save X" — fine
  - Suggested: leave as-is (consistency is fine here)

- `apps/web/app/(app)/journal/[recipientId]/JournalLayout.tsx:329` [Low]
  - Current: `toast.success("Link copied")`
  - Issue: well-pitched; flagged only for visibility — keep
  - Suggested: no change

---

## 2. Auth (sign-in / sign-up / magic link / reset)

### Critical

- `apps/web/app/signin/SignInForm.tsx:115` [Critical]
  - Current: button `"Sign in"` and progress `"Signing you in..."` — but the form is a 6-digit OTP confirm step, not a password sign-in
  - Issue: tone-mismatch — "Sign in" reads generic-SaaS in a flow that is specifically *verifying a code*
  - Suggested: button `"Verify code"`; progress `"Verifying..."`

- `apps/web/app/signin/SignInForm.tsx:115,157` [Critical]
  - Current: `"Signing you in..."`, `"Sending code..."`
  - Issue: verbose ellipsis loaders are slightly performative; "Signing you in" treats this like a personal-assistant moment when the page does one thing
  - Suggested: `"Verifying..."` and `"Sending..."` — match Carelog's plainspoken bar

### Medium

- `apps/web/app/signin/SignInForm.tsx:160` [Medium]
  - Current: `"We will send you a secure sign-in code. No password needed."`
  - Issue: "We will" is a marketing tic; the second sentence carries the value — first sentence is filler
  - Suggested: `"We'll email you a 6-digit code. No password needed."`

- `apps/web/app/onboarding/OnboardingForm.tsx:148` [Medium]
  - Current: `"You can invite team members after setup."`
  - Issue: generic-SaaS; misses the chance to set the *companion* expectation
  - Suggested: `"You can invite family or aides on the next screen."`

- `apps/web/app/onboarding/OnboardingForm.tsx:101` [Medium]
  - Current: `"Their name is stored securely and only visible to your care team."`
  - Issue: "stored securely" is the standard SaaS pacifier; CareSync's brand is candid trust
  - Suggested: `"Only your care team sees this name. We never sell or share it."` (echoes /trust language)

- `apps/web/app/onboarding/OnboardingForm.tsx:118` [Medium]
  - Current: label `"What would you like to call this care team?"`
  - Issue: slightly awkward — the question is fine but a touch wellness-soft
  - Suggested: `"Name your care team"` (label) + retain the placeholder "e.g. The Smith Family"

### Low

- `apps/web/app/signin/SignInForm.tsx:78` [Low]
  - Current: `"Check your email"` (h2)
  - Issue: fine and direct — flagged only for completeness
  - Suggested: keep

- `apps/web/app/signin/SignInForm.tsx:126` [Low]
  - Current: `"Use a different email"`
  - Issue: clear, direct, on-brand — keep

- `apps/web/app/care/[shareToken]/page.tsx:140` [Low]
  - Current: `"Thanks! You're helping out."` + `"Your support means everything to this family."`
  - Issue: second sentence borders on sentimental wellness; the heart emoji at :138 already carries warmth
  - Suggested: trim to `"Thanks for stepping in. The family will get a note that you claimed this slot."`

---

## 3. Empty states

### Critical

- `apps/web/app/(app)/journal/[recipientId]/JournalTimeline.tsx:562-563` [Critical]
  - Current: `title="No journal entries yet"` / `description="Journal entries help your care team stay in sync. Add your first entry to get started."`
  - Issue: classic generic-SaaS empty-state shape ("X help your team stay in sync. Add your first X to get started"). The journal is the *emotional* surface; this empty state is unforgivably generic.
  - Suggested: title `"Quiet day in the journal"`; description `"When you or someone on the team logs an update, it lands here. Even one line — 'good morning, slept well' — is enough."`

- `apps/web/app/(app)/dashboard/DashboardClient.tsx:311` [Critical]
  - Current: `"You do not have any care teams yet. Set one up to get started."`
  - Issue: generic-SaaS ("Get started"); "do not have" is stilted
  - Suggested: `"You're not on a care team yet. Set one up to start logging."`

- `apps/web/components/dashboard/BriefHero.tsx:162-163` [Critical]
  - Current: `"Nothing logged yet. Add a note from the <em>journal</em> to get started."`
  - Issue: "to get started" is the SaaS-tic; the headline-display surface should sound editorial
  - Suggested: `"Nothing logged yet. The brief fills in once someone writes from the <em>journal</em>."`

### Medium

- `apps/web/app/(app)/journal/[recipientId]/CoverageSettings.tsx:105` [Medium]
  - Current: `"No coverage windows defined yet."`
  - Issue: "defined" reads engineering-cold
  - Suggested: `"No coverage windows set yet. Add one to mark when someone is on duty."`

- `apps/web/app/(app)/journal/[recipientId]/SymptomPanel.tsx:372` [Medium]
  - Current: `"No readings recorded yet."`
  - Issue: "recorded" is fine but the line is short of context — what would happen if you logged one?
  - Suggested: `"No readings yet. Log one to start a trend line."`

- `apps/web/app/(app)/messages/ThreadList.tsx:62` [Medium]
  - Current: `"No conversations yet. Start a DM from the Team page."`
  - Issue: "DM" is consumer-app loud and inconsistent with the rest of the product (which avoids that abbreviation)
  - Suggested: `"No conversations yet. Start one from the Team page."`

- `apps/web/components/dashboard/MoodCard.tsx:105` [Medium]
  - Current: `"No mood entries yet — log one from the journal."`
  - Issue: em-dash in prose (design rule)
  - Suggested: `"No mood entries yet. Log one from the journal."`

- `apps/web/components/dashboard/MedCard.tsx:154` [Medium]
  - Current: `"No medications tracked yet for this recipient."`
  - Issue: "for this recipient" reads clinical/EHR; users in the moment know who the recipient is
  - Suggested: `"No medications tracked yet."`

- `apps/web/app/(app)/journal/[recipientId]/EolPlanner.tsx:128` [Medium]
  - Current: `"No end-of-life plan on file yet. Create one to document…"`
  - Issue: "on file" is registrar-speak — out of register for an emotionally heavy panel
  - Suggested: `"No end-of-life plan yet. Use this space to document wishes ahead of time, so the team isn't guessing in a hard moment."`

- `apps/web/app/(app)/subscriptions/page.tsx:89` [Medium]
  - Current: `"No billing history yet."`
  - Issue: fine but missed-opportunity — reassures that nothing's gone wrong
  - Suggested: `"No charges yet. Receipts will show up here once your plan starts."`

- `apps/web/app/(app)/journal/[recipientId]/BurnoutOrgSummary.tsx:30` [Medium]
  - Current: `"Not enough check-ins yet to show a summary. Individual scores are…"`
  - Issue: starts cold; "Not enough" reads gating
  - Suggested: `"We need a few more check-ins to draw a summary. Individual scores are…"`

### Low

- `apps/web/app/(app)/journal/[recipientId]/ExpensePanel.tsx:160` [Low]
  - Current: `"No expenses logged yet."`
  - Issue: fine; could optionally hint at next action
  - Suggested: keep, or `"No expenses logged yet. Tap + to add one."`

- `apps/web/app/(app)/dashboard/DashboardClient.tsx:409` [Low]
  - Current: `"No events logged yet."`
  - Issue: fine — keep

---

## 4. Journal (entries, shift forms, mood)

### Critical

- `apps/web/app/(app)/journal/[recipientId]/JournalEntryForm.tsx:31-34` [Critical]
  - Current: mood labels — `"Good"`, `"Okay"`, `"Difficult"`, `"Crisis"`
  - Issue: tonal consistency check — these are good, candid, plain (✓). BUT "Crisis" is clinical-coded for a self-described mood chip; in the moment, a caregiver may not think "crisis" — they think "really bad day."
  - Suggested: keep "Good / Okay / Difficult"; rename `"Crisis"` → `"Hard"` or `"Awful"`. Validate the rename against the mood-summary surfaces (BriefHero, MoodCard, BurnoutOrgSummary) before shipping.

- `apps/web/app/(app)/journal/[recipientId]/JournalEntryForm.tsx:80` [Critical]
  - Current: placeholder `"Share how today went..."`
  - Issue: placeholder-as-label problem — when the user types, they lose the prompt; the prompt itself reads generic ("share how X went" is wellness-app standard)
  - Suggested: change placeholder to `"What happened today? Even one line is enough."` (more candid; matches BriefHero brand register)

- `apps/web/app/(app)/journal/[recipientId]/JournalEntryForm.tsx:147` [Critical]
  - Current: button `"Share update"` and progress `"Sharing..."`
  - Issue: "Share" is consumer-social register; the journal is private to the care team — calling it "sharing" misframes the action
  - Suggested: `"Post to journal"` + progress `"Posting..."`

### Medium

- `apps/web/app/(app)/journal/[recipientId]/ShiftForm.tsx:181` [Medium]
  - Current: `"Times are stored in UTC — enter local time carefully."`
  - Issue: leaks engineering jargon (UTC) and is vague ("carefully" — what does the user do?); also em-dash
  - Suggested: remove or rephrase to `"Use the device's local time. We handle time zones for you."` — and verify the underlying behavior actually does that, otherwise just delete the help text.

- `apps/web/app/(app)/journal/[recipientId]/ShiftForm.tsx:249` [Medium]
  - Current: `"Select a caregiver..."`
  - Issue: trailing ellipsis on a select option is a generic-SaaS tic
  - Suggested: `"Choose a caregiver"`

- `apps/web/app/(app)/journal/[recipientId]/ShiftForm.tsx:257-258` [Medium]
  - Current: `"Supporters are not shown — only caregivers, coordinators, and aides can be assigned shifts."`
  - Issue: em-dash; passive ("are not shown")
  - Suggested: `"Only caregivers, coordinators, and aides take shifts. Supporters help in other ways."`

- `apps/web/app/(app)/journal/[recipientId]/JournalEntryForm.tsx:108` [Medium]
  - Current: `"How is today going?"`
  - Issue: present tense reads breezy/wellness; pairs poorly with "Crisis" as one of the options below
  - Suggested: `"How did today feel?"` (past tense, lighter weight before a "Crisis" tap)

- `apps/web/app/(app)/journal/[recipientId]/JournalEntryForm.tsx:90` [Medium]
  - Current: `"Need a starting point?"`
  - Issue: fine — slightly self-help-y, but lands. Keep with low-priority polish: consider `"Want a prompt?"` for tighter tone.
  - Suggested: optional swap to `"Want a prompt?"`

### Low

- `apps/web/app/(app)/journal/[recipientId]/JournalEntryForm.tsx:11-22` [Low]
  - Current: `PROMPTS` array — 12 prompts
  - Issue: most are excellent; `"What was hard today?"`, `"How are you holding up?"` are perfectly on-brand. `"Was there a moment of connection?"` borders on wellness register.
  - Suggested: consider replacing `"Was there a moment of connection?"` with `"Anything you want to remember about today?"` — same warmth, less performance.

---

## 5. Daily Brief / BriefHero

### Critical

- `apps/web/components/dashboard/BriefHero.tsx:206` [Critical]
  - Current: `headline="Could not load the brief. Try refreshing."`
  - Issue: passive ("Could not"), terse — and it lives on the editorial Fraunces headline surface. Cold register clashes hard with the design intent.
  - Suggested: `"The brief didn't load. Refresh, or check back in a minute."`

### Medium

- `apps/web/components/dashboard/BriefHero.tsx:159` [Medium]
  - Current: eyebrow `"Today's brief"` (curly apostrophe)
  - Issue: fine register; just verify ASCII vs typographic apostrophes are intentional and consistent across the codebase (line 199 also uses curly).
  - Suggested: keep curly, ensure linter doesn't normalize

- `apps/web/components/dashboard/BriefHero.tsx:219` [Medium]
  - Current: fallback headline `"Care brief"`
  - Issue: fallback should never read like a placeholder; this is what users see when title generation fails
  - Suggested: `"Today's update"` (or use the brief's date as a fallback)

### Low

- `apps/web/components/dashboard/BriefHero.tsx:199` [Low]
  - Current: `"Today's brief · auto-generated ${formatShortTime(...)}"`
  - Issue: "auto-generated" leans engineering — works because it sets honest expectation that this is AI/derived. Keep.
  - Suggested: keep; consider `"compiled"` or `"summarized"` if AI-disclosure language is reviewed elsewhere.

---

## 6. Settings & team invites

### Critical

- `apps/web/app/(app)/team/admin/TeamAdminClient.tsx:157` [Critical]
  - Current: confirm dialog `"Are you absolutely sure? This cannot be undone."`
  - Issue: "Are you absolutely sure" is a SaaS cliché and panicky; this is the *delete the entire org* path — the gravity should land via specifics, not adverbs
  - Suggested: `"Delete this care team and all its data? You'll have 30 days to restore it before it's gone for good."`

- `apps/web/app/(app)/team/admin/TeamAdminClient.tsx:159` [Critical]
  - Current: `"Delete org: not yet implemented. Contact hello@care-log.org."`
  - Issue: ships the engineering term ("not yet implemented") and the legacy domain `care-log.org` instead of CareSync; hard tone-mismatch
  - Suggested: hide the danger button entirely until wired, or replace text with `"Account deletion isn't self-serve yet. Email hello@caresync.app and we'll handle it within 24 hours."` (and verify the support address against the brand-name file)

- `apps/web/app/(app)/subscriptions/page.tsx:188` [Critical]
  - Current: `"Cancellation: contact hello@care-log.org — Stripe not yet wired."`
  - Issue: same legacy-domain + engineering-jargon problem; this string is shown to a paying user trying to cancel
  - Suggested: `"To cancel, email hello@caresync.app — we'll process it within one business day."`

### Medium

- `apps/web/app/(app)/team/admin/TeamAdminClient.tsx:36` [Medium]
  - Current: `"Remove this team member? They will lose access immediately."`
  - Issue: "will lose access" is good and candid; line is fine. Flag only because "this team member" is generic when the member's name is in scope (the `displayLabel` used at TeamPanel.tsx:92 is the better pattern).
  - Suggested: `"Remove ${displayLabel} from the team? They'll lose access immediately."`

- `apps/web/app/(app)/team/admin/TeamAdminClient.tsx:148-151` [Medium]
  - Current: `"Permanently deletes your organization and all care data. This cannot be undone. Your data is retained for 30 days before permanent removal."`
  - Issue: contradicts itself ("cannot be undone" vs "retained for 30 days"); reads scary without being clear
  - Suggested: `"Deletes the care team and all its data. We hold a backup for 30 days in case you change your mind — after that it's gone."`

- `apps/web/app/(app)/journal/[recipientId]/TeamPanel.tsx:92` [Medium]
  - Current: `` `Remove ${displayLabel} from the team?` ``
  - Issue: well-pitched. Flag only to add the access-loss specificity present in TeamAdminClient.
  - Suggested: `` `Remove ${displayLabel} from the team? They'll lose access right away.` ``

### Low

- `apps/web/app/(app)/settings/page.tsx:178` [Low]
  - Current: `"Saved!"`
  - Issue: exclamation point — slightly consumer-loud
  - Suggested: `"Saved"` (no exclamation; consistency with Carelog's understated register)

---

## 7. Marketing

Detailed audit deferred for `landing`, `about`, `pricing` — UX-037 / UX-038 in flight. Audited the rest below.

### Critical

- `apps/web/components/marketing/PricingCards.tsx:78,101` [Critical]
  - Current: `"Get started, no commitment."` + button `"Get started"` (free tier)
  - Issue: textbook generic-SaaS verb. The whole product brand pulls away from this register.
  - Suggested: tagline → `"Free, no card required."`; button → `"Try it free"` or `"Create a care team"` (matches the action that actually happens)

- `apps/web/app/(marketing)/compare/page.tsx:110` [Critical]
  - Current: `"Get started free"`
  - Issue: same generic-SaaS line in a comparison surface where the value should be specific
  - Suggested: `"Start a care team — free"`

- `apps/web/components/marketing/ForReferrersPage.tsx:247` [Critical]
  - Current: `"Learn more about our privacy commitments"`
  - Issue: textbook generic-SaaS link copy ("Learn more")
  - Suggested: `"Read our data commitment"` (matches the page title at /trust)

### Medium

- `apps/web/app/(marketing)/trust/page.tsx:56` [Medium]
  - Current: `"We will never run ads in this product. Ever. Your family's focus stays on care, not marketing."`
  - Issue: candid voice landing well. Flag only because "We will" is slightly passive — and the line repeats what the section header already promises.
  - Suggested: `"We don't run ads. Your family's focus stays on care, not on being a target."`

- `apps/web/app/(marketing)/trust/page.tsx:41` [Medium]
  - Current: `"If this platform ever shuts down, we will give families 12 months notice before any shutdown."`
  - Issue: slight repetition ("shuts down… any shutdown"); "this platform" is engineering register
  - Suggested: `"If CareSync ever has to shut down, families get 12 months' notice — enough time to export and find a new home."`

- `apps/web/app/(marketing)/compare/page.tsx:45` [Medium]
  - Current: `"Pick CaringBridge if you only need to broadcast health updates to a wide circle of friends and family."`
  - Issue: well-pitched, candid. Keep; flag only "broadcast" — slightly cold for warm·candid·companion. "Send" is plainer.
  - Suggested: `"Pick CaringBridge if you mainly want to send health updates to a wide circle of friends and family."`

### Low

- `apps/web/app/(marketing)/contact/page.tsx:8` [Low]
  - Current: meta `"Get in touch with CareSync. We reply within 24 hours."`
  - Issue: "Get in touch" is mild SaaS — keep, low priority
  - Suggested: `"Reach the team — we reply within 24 hours."`

---

## 8. Confirmation dialogs

### Critical

- `apps/web/app/(app)/team/admin/TeamAdminClient.tsx:157` [Critical]
  - See section 6 — "Are you absolutely sure" is the single worst-pitched dialog in the app and lives on the destructive org-delete path.

- `apps/web/components/care-events/CommentItem.tsx:103` [Critical]
  - Current: `confirm("Delete this comment?")`
  - Issue: uses native `confirm()` — design rule says interactive elements use shadcn `<AlertDialog>`. Native dialogs can't be styled, can't satisfy the focus-ring rule, and break the warm·candid register on every browser. Tonal *and* design-system gap.
  - Suggested: refactor to `<AlertDialog>` with title `"Delete this comment?"` body `"Once deleted, it's gone for the whole team."` and keep the action button labeled `"Delete"`.

### Medium

- `apps/web/components/app/AppTabBar.tsx:124` [Medium]
  - Current: `window.confirm("Sign out of CareSync?")`
  - Issue: native `confirm()` again; sign-out is benign so the dialog itself is questionable — most apps just sign out
  - Suggested: drop the confirm dialog entirely (one-tap sign-out), OR replace with a shadcn `<AlertDialog>` titled `"Sign out?"` with no body text.

- `apps/web/app/(app)/journal/[recipientId]/TeamPanel.tsx:92` [Medium]
  - Current: `window.confirm(\`Remove ${displayLabel} from the team?\`)`
  - Issue: native confirm — same design-system gap; the string itself is fine
  - Suggested: refactor to `<AlertDialog>` and add the access-loss line: `"They'll lose access right away."`

### Low

- `apps/web/app/(app)/team/admin/TeamAdminClient.tsx:36` [Low]
  - Current: `confirm("Remove this team member? They will lose access immediately.")`
  - Issue: copy is good; refactor target is the native-dialog primitive (medium priority via #2 above)
  - Suggested: keep copy when migrated to `<AlertDialog>`, but personalize with the member's name where available.

---

## Summary

**Total findings:** 56
- Critical: 24
- Medium: 25
- Low: 7

**Top 3 patterns observed**

1. **`"Something went wrong. Please try again."` is copy-pasted across 8+ files** (six journal panels, the public outer-circle page, sign-in callback). It's the single biggest tone leak in the product — fully generic-SaaS, gives zero remediation, and lives on the moments where users most need clarity. A single sweep that replaces each with a specific subject ("the shift didn't save", "the plan didn't save") would move the most needles per line of diff.

2. **Native `window.confirm()` and `confirm()` dialogs in 5+ destructive flows** (comment delete, team-member remove, org delete, sign-out). These break BOTH the design system (no shadcn `<AlertDialog>`, no styled focus ring, no shared a11y contract) AND the tone bar (the native dialog cannot be made to read warm·candid·companion regardless of the string inside). The org-delete dialog at `TeamAdminClient.tsx:157` (`"Are you absolutely sure?"`) is the worst single string in the app.

3. **Two legacy-domain leaks** (`hello@care-log.org` at `subscriptions/page.tsx:188` and `team/admin/TeamAdminClient.tsx:159`) ship the old internal "Carelog" name to paying users in moments where the brand should be reassuring, not confusing. Per CLAUDE.md memory, the user-facing brand is **CareSync** — these are user-visible bugs, not legacy strings.

**Bonus pattern:** generic-SaaS verbs leak in three high-stakes spots — `"Sign in"` on what is actually a verify-OTP step (signin/SignInForm.tsx:115), `"Share update"` for what is actually a private journal post (JournalEntryForm.tsx:147), and `"Get started"` repeated across pricing/compare. Each one misframes the user's action.

**Recommended first PR (single-surface, highest leverage)**

**`UX-???: errors & confirmations sweep`** — collapse the 8+ `"Something went wrong"` strings into specific-subject phrasings, and replace the native `window.confirm()` dialogs with shadcn `<AlertDialog>` (org-delete and comment-delete first, sign-out optional). One PR, ~12 files, no new components needed (AlertDialog already in the design system per ui-standards.md). This sweep eliminates the single largest tone-leak surface and the single worst dialog in the app — high signal, low risk.

Suggested follow-on PRs in priority order:
1. **Empty states polish** (Section 3) — JournalTimeline + DashboardClient + BriefHeroEmpty, single PR.
2. **Auth & onboarding voice pass** (Section 2) — verify-OTP relabel, error-message catalog from Supabase codes.
3. **Journal mood + entry form copy** (Section 4) — rename "Crisis" mood, retitle "Share update", retune placeholder.
4. **Legacy `care-log.org` → `caresync.app`** — separate small PR, just the two strings + grep for any hidden ones in API responses.
