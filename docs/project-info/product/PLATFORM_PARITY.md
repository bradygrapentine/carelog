# Platform Parity — Web / iOS / Android

Snapshot: 2026-04-14. Compares feature surface of the three client platforms and classifies each delta as **expected** (by design) or **gap** (should be closed). Stories for gaps live at the bottom — prefix `PP-` (Platform Parity).

---

## Method

- **Web** = `apps/web/app/` authenticated routes under `(app)/` plus auth/onboarding/invite/billing/marketing
- **iOS** = `apps/mobile/` running on iOS (has `ios/` native dir prebuilt, plus `watchos/` and `modules/carelog-watch/ios/`)
- **Android** = `apps/mobile/` running on Android — **no `android/` native dir has been prebuilt** (`npx expo prebuild -p android` has never been run). The shared RN/Expo JS is Android-ready; the native project is not.

---

## Feature Inventory

Legend: ✅ present · 🟡 partial · ❌ absent · `—` not applicable

| Feature | Web | iOS | Android | Status |
|---|---|---|---|---|
| **Auth: email OTP signin** | ✅ `/signin` | ✅ `(auth)/` | ✅ shared JS | Expected parity |
| **Invite accept flow** | ✅ `/invite/[token]` | ✅ `(app)/invite/` | ✅ shared JS | Expected parity |
| **Onboarding (create household)** | ✅ `/onboarding/create` | 🟡 inline in `(auth)` | 🟡 inline | **Gap** — mobile lacks explicit onboarding wizard |
| **Dashboard / home** | ✅ `/dashboard` | ✅ `(app)/index.tsx` | ✅ shared JS | Expected parity |
| **Journal — read feed** | ✅ `/journal/[recipientId]` per recipient | ✅ `(app)/journal` flat list | ✅ shared JS | Expected — platform-appropriate shape |
| **Journal — event detail** | 🟡 inline | ✅ `(app)/journal/[eventId]` dedicated screen | ✅ shared JS | Expected (mobile navigation idiom) |
| **Team / members list** | ✅ `/team` + `/team/admin` | ✅ `(app)/team` | ✅ shared JS | Expected parity |
| **Team admin (role, remove, re-invite)** | ✅ `/team/admin` | ❌ | ❌ | **Gap** — admin actions only on web |
| **Billing — manage subscription** | ✅ `/billing`, `/subscriptions` | ❌ no billing UI | ❌ | Partially expected (IAP complexity) — see PP-005 |
| **Billing success callback** | ✅ `/billing/success` | — | — | Expected (Stripe redirect is web-only) |
| **Marketing pages** (about, pricing, privacy, terms, contact) | ✅ `(marketing)/` | — | — | Expected (public web) |
| **Medications** | ❌ | ✅ `(app)/medications` | ✅ shared JS | **Gap** — web missing |
| **Symptoms tracker** | ❌ | ✅ `(app)/symptoms` | ✅ shared JS | **Gap** — web missing |
| **Expenses** | ❌ | ✅ `(app)/expenses` | ✅ shared JS | **Gap** — web missing |
| **Schedule / shifts** | ❌ | ✅ `(app)/schedule` | ✅ shared JS | **Gap** — web missing |
| **Documents (with iOS share sheet)** | ❌ | ✅ `(app)/documents` (iOS-specific share via `Platform.OS`) | 🟡 shared JS, fallback share | **Gap web** / expected platform tweak on mobile |
| **Care brief (AI summary)** | ✅ `/brief` | ✅ `(app)/care-brief` | ✅ shared JS | Expected parity |
| **Burnout screener** | ❌ | ✅ `(app)/burnout` | ✅ shared JS | **Gap** — web missing |
| **Outer circle (extended supporters)** | ❌ | ✅ `(app)/outer-circle` | ✅ shared JS | **Gap** — web missing |
| **EOL planner** | ❌ | ✅ `(app)/eol-planner` | ✅ shared JS | **Gap** — web missing |
| **Benefits info** | ❌ | ✅ `(app)/benefits` | ✅ shared JS | **Gap** — web missing |
| **Settings** | 🟡 scattered | ✅ `(app)/settings` | ✅ shared JS | **Gap** — web lacks a settings hub |
| **"More" hub nav** | — | ✅ `(app)/more` | ✅ | Expected (mobile idiom; web uses sidebar) |
| **Push notifications** | ❌ (no web push yet) | ✅ `expo-notifications` + device token | 🟡 expo-notifications supports Android but unverified | **Gap** — web push + verify Android token flow |
| **Native camera / image picker** | ❌ (file input) | ✅ `expo-image-picker`, `expo-camera` | 🟡 shared JS (not verified) | Expected platform tweak |
| **Haptics** | — | ✅ `expo-haptics` | 🟡 shared (Android supports) | Expected |
| **watchOS companion** | — | ✅ `modules/carelog-watch/ios` + `watchos/` target + `plugins/withCarelogWatch` | — | Expected (Apple-only) |
| **Wear OS companion** | — | — | ❌ | Intentionally descoped — see PP-009 |
| **Deep linking** | ✅ `/invite/[token]` | ✅ `yourcarelog://` + universal links `applinks:yourcarelog.com` | 🟡 intent filter defined for `https://yourcarelog.com/invite` but untested | **Gap** — verify Android app links |
| **Sentry** | ✅ | ✅ `@sentry/react-native` | ✅ same JS | Expected parity |
| **PostHog analytics** | ✅ | ✅ `posthog-react-native` | ✅ same JS | Expected parity |
| **Offline queue / sync** | ❌ (web requires connectivity) | 🟡 `@react-native-community/netinfo` wired | 🟡 shared | **Gap** — offline behavior not fully specified |

---

## Summary of Classifications

**Expected differences** (platform idioms, not gaps):
- Journal shape (web = per-recipient page; mobile = flat list + detail screen)
- Stripe billing redirect flow is web-only
- watchOS companion is Apple-only by definition
- Marketing pages are web-only
- Camera/haptics/push are native-only
- Mobile has a "More" hub; web has a sidebar

**Real gaps** (web-vs-mobile feature imbalance):
1. Web is missing: medications, symptoms, expenses, schedule, documents, burnout screener, outer-circle, EOL planner, benefits, a unified settings hub
2. Mobile is missing: team admin actions, explicit onboarding wizard, explicit billing/subscription management
3. Android is missing: native project never prebuilt, push/deep-linking unverified, no Wear OS companion (intentional)
4. Cross-cutting: no web push, offline behavior under-specified

---

## Stories

> Format: `PP-NNN` · priority · effort (S/M/L) · acceptance notes. Drop into sprint or `OVERNIGHT_BACKLOG.md` when scheduled.

### Web feature catch-up (mobile has it, web doesn't)

- **PP-001** · P1 · L — **Web: Medications**
  Port the mobile medications screen to web at `/medications`. CRUD, reminders, dose history. Must reuse the same tRPC endpoints as mobile. AC: list, add, edit, delete, log dose; a11y pass; Playwright smoke.

- **PP-002** · P1 · L — **Web: Symptoms tracker**
  `/symptoms` — chronological symptom logging with severity, tags, attachment to a recipient. AC: list + filter, add entry, edit/delete, chart view optional for v1.

- **PP-003** · P2 · M — **Web: Expenses**
  `/expenses` — log, categorize, attach receipt (reuse document upload), monthly summary. AC: CRUD + monthly total card.

- **PP-004** · P2 · M — **Web: Schedule / shifts**
  `/schedule` — weekly view of caregiver shifts, assignment, swap request (ties into ON-45 if/when built). AC: week grid + CRUD on shifts.

- **PP-005** · P1 · M — **Web: Documents**
  `/documents` — upload, tag, share by link. Reuse the storage bucket already in use on mobile. AC: upload, preview, delete, copy signed URL.

- **PP-006** · P2 · M — **Web: Burnout screener**
  `/burnout` — port the in-app screener. Results stored per-member, trend shown over time. AC: take screener, persist, show last-30-day trend.

- **PP-007** · P3 · M — **Web: Outer circle**
  `/outer-circle` — extended supporter contacts with coarse-grained sharing. AC: list, add, edit, remove.

- **PP-008** · P3 · M — **Web: EOL planner**
  `/eol-planner` — wishes, directives, contact list. AC: parity with mobile; PDF export is a stretch goal.

- **PP-009** · P3 · S — **Web: Benefits**
  `/benefits` — reference content about Medicare/Medicaid/VA benefits. Static-ish; mostly content parity with mobile.

- **PP-010** · P2 · S — **Web: Settings hub**
  `/settings` — single page with profile, notification prefs, timezone, language, danger zone. Today it's scattered. AC: unified page with tabs or sections.

### Mobile catch-up (web has it, mobile doesn't)

- **PP-011** · P1 · M — **Mobile: Team admin actions**
  Mobile team screen currently shows members only. Add admin capabilities: change role, remove member, re-invite. Gate on admin role. AC: parity with web `/team/admin`; pgTAP coverage already exists.

- **PP-012** · P2 · M — **Mobile: Onboarding wizard**
  First-run flow that explicitly walks through: name household, add first recipient, invite first member. Today it's inline and easy to skip. AC: dedicated `(onboarding)` stack, resumable, skip-to-app option.

- **PP-013** · P2 · L — **Mobile: Subscription management surface**
  Read-only view of plan + seat count + next bill date + "manage on web" CTA. Full IAP integration is out of scope for v1 (App Store policy complexity). AC: status card, tap-to-open Stripe portal URL in in-app browser.

### Android-specific

- **PP-014** · P0 · S — **Android: Prebuild and verify boot**
  Run `npx expo prebuild -p android --clean`, commit the generated `android/` directory (or add to `.gitignore` + document the build step), and verify `pnpm --filter mobile android` boots on an emulator. AC: CI can build an Android debug APK.

- **PP-015** · P1 · S — **Android: Verify push notifications**
  Confirm `expo-notifications` registers with FCM, token is sent to the backend under `platform: 'android'`, and notifications land. AC: tap notification → deep-link works.

- **PP-016** · P1 · S — **Android: Verify app links (intent filter)**
  `app.json` already declares `https://yourcarelog.com/invite` intent filter. Verify it resolves on a real device, `autoVerify` passes (Digital Asset Links file in place), and `/invite/[token]` opens inside the app. AC: clicking an invite email link on Android opens the app, not Chrome.

- **PP-017** · P2 · M — **Android: Visual QA pass**
  Screenshot each top-level screen on Android, compare against iOS. Fix RN-specific layout issues (elevation vs shadow, system UI overlap, back-gesture handling). AC: PR with side-by-side screenshots, no layout regressions.

- **PP-018** · P3 · L — **Wear OS companion (descoped for v1)**
  Explicitly parked. Revisit after iOS watchOS ships and we see usage.

### Cross-cutting

- **PP-019** · P2 · M — **Web push notifications**
  Add web push (FCM/APNs via the browser Push API) for the subset of events mobile users already receive: new journal entry, schedule change, med reminder. AC: opt-in UI, server-side push, unsubscribe.

- **PP-020** · P2 · L — **Offline behavior spec + implementation**
  Define write-queue semantics on mobile when offline (journal entries, med doses are the priority). Web stays online-only. AC: design doc + happy-path queue for journal entries.

- **PP-021** · P3 · S — **Consolidate URL scheme**
  `app.json` uses `yourcarelog://` but brand is `carelog`. Decide and align (and update `scripts/mobile-ui.sh` accordingly). AC: single scheme referenced everywhere.

---

## Notes for scheduling

- **PP-014 is a blocker** for all other Android work. Do it first.
- PP-001, PP-002, PP-005, PP-011 are the highest-leverage "close the obvious product gap" items.
- PP-018 and PP-021 can sit as footnotes until someone asks.
