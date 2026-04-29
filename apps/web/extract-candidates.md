# CareSync Extract Candidates — `/impeccable extract` Phase A

**Status:** seeded 2026-04-29; full Phase A discovery deferred until PR #290 (UX-047) merges, then UX-048..051 land.

Working artifact (untracked). Pulled into a dedicated extract PR sequence in Phase B.

**What goes here:** repeated patterns used **3+ times with the same intent**, ranked by extraction value. Each row: candidate · current usage · proposed location · prop sketch · effort.

**Anti-extractions** (look duplicated but differ in intent — keep separate) live at the bottom.

---

## Candidates

### 1. `<AlertDialog>` — destructive-action confirmation primitive
- **Status:** primitive ALREADY ADDED in PR #290 (`apps/web/components/ui/alert-dialog.tsx`, built atop `@base-ui/react`). This row tracks downstream consumer migrations.
- **Current usage (post-#290):** 3 sites — TeamAdminClient org-delete, TeamAdminClient member-remove, CommentItem comment-delete.
- **Pending migrations** (UX-052 row): `AppTabBar.tsx:124` sign-out + `TeamPanel.tsx:92` alt member-remove. After UX-052: 5 sites.
- **Proposed location:** already at `apps/web/components/ui/alert-dialog.tsx`.
- **Action for Phase A:** verify the primitive's prop API is sufficient for all 5 call sites (action-specific button labels mandatory; the project rule is "Delete organization" never "Yes"). Document the canonical pattern in DESIGN.md §5 Components when extract Phase B runs.
- **Effort:** zero — just doc + surface a usage example.

## High value (extract Phase B-1, ready now)

### 2. `formatTime()` / `formatDate()` — date/time formatter helpers
- **Current usage:** 8+ sites with copy-pasted `function formatDate(iso)` / `formatTime` — `apps/web/components/dashboard/MedCard.tsx:14`, `apps/web/components/VisitSummary.tsx:64`, `apps/web/app/care/[shareToken]/page.tsx:33`, `apps/web/app/api/export/ExportDocument.tsx:93`, `apps/web/app/(app)/journal/[recipientId]/JournalTimeline.tsx:53` (and `formatDateHeader` :308), `apps/web/app/(app)/journal/[recipientId]/entry/[eventId]/EntryDetailClient.tsx:30`, `apps/web/app/brief/[shareToken]/BriefEditorial.tsx:37`. Plus 12+ inline `new Date(x).toLocaleDateString()` / `toLocaleTimeString` calls (e.g. `MessageView.tsx:16`, `OcrReviewPanel.tsx:187`, `DocumentVault.tsx:253`, `SymptomPanel.tsx:383`, `ShiftPopover.tsx:107`, `ShiftEventCard.tsx:7-11`, `TradeRequestCard.tsx:107`, `BriefEditorial.tsx:45`, `api/history/export/pdf/route.tsx:211/250/268`).
- **Pattern variations seen:** (a) `"en-US"` long-date `month: "long" / day / year`; (b) short-date `month: "short", day: "numeric"`; (c) `hour: "2-digit", minute: "2-digit"`; (d) `MedCard.formatTime` parses an `HH:MM:SS` clock string (NOT an ISO date) — different intent, keep separate.
- **Proposed location:** `apps/web/lib/format.ts` exporting `formatLongDate(iso)`, `formatShortDate(iso)`, `formatTimeOfDay(iso)`, `formatDateTime(iso)`.
- **Prop sketch:** `formatLongDate(iso: string): string` etc. Pure functions. No props.
- **Effort:** S (lift) + M (~15 consumer migrations).
- **Phase B sequencing:** ready now — copy is settled, formatters are pure.
- **Anti-extraction risk:** `MedCard.formatTime(scheduledTime: string)` parses an `HH:MM:SS` clock string from the meds schedule, not an ISO timestamp — keep that one separate or expose as `formatClockTime(hms)`.

### 3. `surfaceErrorBanner()` — inline form-error banner
- **Current usage:** 4 sites with the same shape "rounded box + danger color + small message" — `apps/web/app/onboarding/OnboardingForm.tsx:134` (`p-3 bg-red-50 border border-red-100 rounded-lg`), `apps/web/app/signin/page.tsx:32` (`mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-[var(--color-danger)]`), `apps/web/app/(app)/team/admin/TeamAdminClient.tsx:78` (`mt-4 rounded-xl bg-[var(--color-danger-subtle)] px-4 py-3 text-sm text-[var(--color-danger)]`), plus the 5 inline `<p className="text-sm text-[var(--color-danger)]">` field-error sites (`MedCard.tsx:147`, `MoodCard.tsx:77`, `ContactForm.tsx:99`, `SignInForm.tsx:123/168`, `OnboardingForm.tsx:135`, `care/[shareToken]/page.tsx:313`).
- **Pattern variations seen:** TeamAdmin uses `--color-danger-subtle` token; the older sign-in/onboarding banners hardcode `bg-red-50` (token gap). Two intents emerge: (a) **block-level banner** (banner above a form) and (b) **inline field-error caption** (`<p role="alert">` after a field).
- **Proposed location:** `apps/web/components/ui/ErrorBanner.tsx` (block) + already-canonical inline `<p role="alert">` pattern — only the banner needs extraction.
- **Prop sketch:** `<ErrorBanner role="alert">{message}</ErrorBanner>` — wraps `rounded-xl bg-[var(--color-danger-subtle)] px-4 py-3 text-sm text-[var(--color-danger)]`.
- **Effort:** S (lift) + S (3 banner migrations). Bonus: removes the `bg-red-50` raw-color leaks at signin:32 and onboarding:134.
- **Phase B sequencing:** ready now. Doubles as a UX-* candidate to fix the raw `bg-red-*` token leak.
- **Anti-extraction risk:** keep `<p className="text-sm text-[var(--color-danger)]">` field captions as-is — different intent (caption under a single field, not a banner).

### 4. Mood color class lookups — `moodClasses(mood)`
- **Current usage:** `apps/web/app/(app)/journal/[recipientId]/JournalTimeline.tsx:16-19` (bg map), `:26-29` (border-l map), `:36-41` (chip map), `:332-337` (selected-chip map), `apps/web/components/journal/PatternsStrip.tsx:18` (`bg-[var(--color-mood-okay)]/15`), `apps/web/app/(app)/journal/[recipientId]/SymptomPanel.tsx:66-68` (severity → mood-* token).
- **Pattern variations seen:** Five distinct mappings of mood→color (bg dot, border-l, chip default, chip selected, severity tier). Most use the same `color-mix(in_oklab, ..._N%, white)` family with different alpha tiers (12 / 15 / 18 / 22 / 35 / 40 / 45 / 50%).
- **Proposed location:** Extend existing `apps/web/lib/mood.ts` (already canonical) — add `moodBgClass(mood)`, `moodBorderClass(mood)`, `moodChipClass(mood, { selected })`. Or expose CSS utility classes in `globals.css` (`@layer components`) if Tailwind arbitrary-class fingerprinting is a concern.
- **Effort:** M — multiple consumer call-sites and a real risk of behavior drift if the color-mix percentages aren't kept identical.
- **Phase B sequencing:** ready now, but worth a 10-min design review on whether the 4 alpha tiers (12/15/18/22%) are intentional or accidental drift.
- **Anti-extraction risk:** the 4 alpha tiers may be intentional (chip-resting vs chip-selected vs strip-marker). Confirm before flattening.

### 5. `<FormActionRow>` — Save/Cancel button pair at form footer
- **Current usage:** ≥10 inline forms in `app/(app)/journal/[recipientId]/` use the pattern `<Button type="submit" disabled={loading}>Save</Button> <Button variant="ghost" type="button" onClick={cancel}>Cancel</Button>` — `CoverageSettings.tsx`, `ShiftForm.tsx`, `MedicationPanel.tsx`, `BurnoutCheckin.tsx`, `SymptomPanel.tsx`, `OuterCirclePanel.tsx`, `EolPlanner.tsx`, `JournalEntryForm.tsx`, `ExpensePanel.tsx`, plus `components/shifts/TradeRequestForm.tsx`, `ShiftPopover.tsx`, `marketing/ContactForm.tsx`.
- **Pattern variations seen:** primary-button label varies (Save/Send/Add/Invite/Log) — must accept `submitLabel`. Some show a loading spinner; some omit Cancel for one-shot actions.
- **Proposed location:** `apps/web/components/ui/FormActionRow.tsx`.
- **Prop sketch:** `<FormActionRow submitLabel="Save" loading={...} onCancel={...} disabled={...} />` — Cancel button only renders when `onCancel` is provided.
- **Effort:** S (lift) + M (~10–12 migrations + tests).
- **Phase B sequencing:** ready now. Click-to-open form pattern in ui-standards.md is settled; this is the canonical footer.
- **Anti-extraction risk:** distinct from `<AlertDialogFooter>` (destructive confirmation) — keep separate. Also distinct from the marketing form CTA, which is a single primary button without Cancel.

---

## Medium value (extract Phase B-2, after UX-048..051 land)

### 6. `<TextLinkButton>` — small inline-text primary action
- **Current usage:** 5+ small "+ Action" or text-link buttons reusing `text-xs text-[var(--color-primary)] hover:... focus:ring-2 focus:ring-[var(--color-primary)]` — `components/shifts/TradeRequestList.tsx:79`, `components/ai/AIChatThread.tsx:65`, `components/journal/PatternsStrip.tsx:112`, `app/(app)/education/[slug]/page.tsx:22`, `app/(app)/journal/[recipientId]/JournalTimeline.tsx:231` (chip pill, similar shape).
- **Pattern variations seen:** Some are `<button>`, some `<Link>`. Some use `bg-primary-subtle` chip background, some are bare text. Two intents: "expand/toggle a panel" vs "navigate to a related page."
- **Proposed location:** `apps/web/components/ui/TextLinkButton.tsx` (or a `Button` `variant="link"` extension).
- **Prop sketch:** `<TextLinkButton size="sm" onClick={...}>+ Add medication</TextLinkButton>`.
- **Effort:** S + S.
- **Phase B sequencing:** **wait for UX-048..051** — these microcopy passes touch the exact CTA strings; let copy settle before locking the API.
- **Anti-extraction risk:** the click-to-open trigger (panel toggle) and the navigation link have **different intents**; ui-standards.md and PRODUCT.md "tone bar" both say split intents stay split. Likely two components, not one.

### 7. `surfaceErrorToast(subject)` — toast wrapper
- **Current usage:** Per the prompt, UX-047 just rewrote ~18 `toast.error("X didn't save. Try again.")` sites. Confirmed pattern but copy is in active flux through UX-048..051.
- **Proposed location:** `apps/web/lib/toast.ts`.
- **Prop sketch:** `surfaceErrorToast("medication")` → `toast.error("Medication didn't save. Try again.")` — could absorb retry-action wiring.
- **Effort:** S.
- **Phase B sequencing:** **defer until UX-048..051 land.** Premature lock-in risk.
- **Anti-extraction risk:** toast.success and toast.info call-sites have very different copy shapes — keep error-toast helper scoped to error-toasts.

---

## Low value / defer

### 8. Search/filter toolbar
- **Current usage:** Could not find a recurring 3+ search/filter toolbar pattern via `useMemo + filter` grep (zero result-files). UI standards reference it, but actual instances do not yet meet the 3-site bar. Defer until a third filterable list ships.

### 9. Confirmation dialog body shape
- **Current usage:** 3 `<AlertDialog>` sites (TeamAdmin org-delete, TeamAdmin member-remove, CommentItem comment-delete). The body prose pattern (`Are you sure? This will… It cannot be undone.`) is similar but the **subject and consequence sentence are intent-specific** (org delete cascades, comment delete is local).
- **Phase B sequencing:** Defer. Document the canonical prose pattern in DESIGN.md §5 instead of extracting a `<ConfirmBody subject=...>` component. The 5 sites listed in candidate #1 still benefit from a *prose checklist*, not a *prose component*.

### 10. Motion / transition tokens
- **Current usage:** `duration-150` (Card hover, GuideCard, SidebarNav, dialog/sheet/alert-dialog overlays), `duration-75` (button base, JournalTimeline chip), `duration-200` (FAB, AIFab, sheet content). Pattern is consistent — `duration-150 ease-out` for shadow/translate, `duration-75` for active/press feedback.
- **Proposed location:** Add `--motion-fast: 75ms`, `--motion-base: 150ms`, `--motion-slow: 200ms` tokens to `globals.css @theme inline`.
- **Effort:** S token addition; M for migrations (low-priority cosmetic).
- **Phase B sequencing:** Low value alone; bundle with a future "design-token catalog hardening" pass.

---

## Anti-extractions

### A1. Save / Cancel action pair vs `<AlertDialogFooter>`
Both render a two-button row; the **intents differ** — form-save is creative, alert-dialog cancel guards a destructive action and ALWAYS uses an action-specific verb ("Delete organization"), never "Yes". Keep separate.

### A2. Tinted CardHeader vs standalone Card
`<TintedCard>` already exists at `components/ui/tinted-card.tsx`. `TradeRequestList.tsx:71` deliberately bypasses it because it needs **dark-mode overrides** (`dark:bg-gray-700` etc.) that `<TintedCard>` does not yet support. Likely the right move is to widen `<TintedCard>` to absorb dark-mode tokens rather than fork.

### A3. `MedCard.formatTime(hms)` vs the proposed `formatTimeOfDay(iso)`
Both return a wall-clock string but parse different inputs (clock-string vs ISO). Calling them both `formatTime` is the trap. Expose them as `formatClockTime(hms)` and `formatTimeOfDay(iso)`.

### A4. `<p role="alert" className="text-sm text-[var(--color-danger)]">` vs `<ErrorBanner>`
Field-error caption (under one input) and form-level banner (above the whole form) look similar but mean different things. Keep the caption as a bare `<p>`; only extract the block-level banner.

### A5. PDF export raw hex (`api/export/ExportDocument.tsx`, `api/history/export/pdf/route.tsx`)
The 12+ raw `#hex` values in `react-pdf` files are NOT a token gap to extract — `react-pdf`'s `StyleSheet.create()` does not support CSS variables (the route already documents this with `/* TODO: no CSS var support in react-pdf */`). Right answer is a typed `pdfTokens.ts` constants file mirroring `globals.css`, not extracting into a CSS-variable consumer.
