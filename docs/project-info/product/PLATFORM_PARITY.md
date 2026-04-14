# Platform Parity — Web / iOS / Android

Snapshot: 2026-04-14. Compares feature surface of the three client platforms and classifies each delta as **expected** (by design) or **gap** (should be closed). Stories for gaps live at the bottom — prefix `PP-` (Platform Parity).

---

## Method

- **Web** = `apps/web/app/` authenticated routes under `(app)/` plus auth/onboarding/invite/billing/marketing
- **iOS** = `apps/mobile/` running on iOS (has `ios/` native dir prebuilt, plus `watchos/` and `modules/carelog-watch/ios/`)
- **Android** = `apps/mobile/` running on Android — **no `android/` native dir has been prebuilt** (`npx expo prebuild -p android` has never been run). The shared RN/Expo JS is Android-ready; the native project is not.

**Important IA difference**: web implements most caregiver features as **panels inside `/journal/[recipientId]`** (`?panel=medications`, `?panel=symptoms`, "More" button → burnout, eol-planner, benefits, outer-circle, shifts, expenses, documents). Mobile implements the same features as **dedicated top-level screens** under `(app)/`. That's an IA choice appropriate to each form factor — it is **not** a feature gap. What follows distinguishes true missing functionality from layout differences.

---

## Feature Inventory

Legend: ✅ present · 🟡 partial · ❌ absent · `—` not applicable

| Feature | Web | iOS | Android | Status |
|---|---|---|---|---|
| **Auth: email OTP signin** | ✅ `/signin` | ✅ `(auth)/` | ✅ shared JS | Expected parity |
| **Invite accept flow** | ✅ `/invite/[token]` | ✅ `(app)/invite/` | ✅ shared JS | Expected parity |
| **Onboarding (create household)** | ✅ `/onboarding/create` | 🟡 inline in `(auth)` | 🟡 inline | **Gap** — mobile lacks explicit wizard |
| **Dashboard / home** | ✅ `/dashboard` | ✅ `(app)/index.tsx` | ✅ shared JS | Expected parity |
| **Journal — read feed** | ✅ `/journal/[recipientId]` per recipient | ✅ `(app)/journal` flat list | ✅ shared JS | Expected — platform-appropriate IA |
| **Journal — event detail** | 🟡 inline in recipient page | ✅ `(app)/journal/[eventId]` dedicated screen | ✅ shared JS | Expected (mobile nav idiom) |
| **Medications** | ✅ `?panel=medications` | ✅ `(app)/medications` | ✅ shared JS | Expected (panel vs screen) |
| **Symptoms tracker** | ✅ `?panel=symptoms` | ✅ `(app)/symptoms` | ✅ shared JS | Expected parity |
| **Expenses** | ✅ `ExpensePanel` | ✅ `(app)/expenses` | ✅ shared JS | Expected parity |
| **Schedule / shifts** | ✅ (shifts spec covers) | ✅ `(app)/schedule` | ✅ shared JS | Expected parity |
| **Documents** | ✅ `/api/documents` + panel | ✅ `(app)/documents` + iOS share sheet | 🟡 shared JS, Android share unverified | Expected panel diff; Android needs verification |
| **Burnout screener** | ✅ "More" panel | ✅ `(app)/burnout` | ✅ shared JS | Expected parity |
| **EOL planner** | ✅ "More" panel | ✅ `(app)/eol-planner` | ✅ shared JS | Expected parity |
| **Benefits** | ✅ `BenefitsNavigator` | ✅ `(app)/benefits` | ✅ shared JS | Expected parity |
| **Outer circle** | ✅ `/api/outer-circle` + UI | ✅ `(app)/outer-circle` | ✅ shared JS | Expected parity |
| **Care brief (AI summary)** | ✅ `/brief` + `/care` | ✅ `(app)/care-brief` | ✅ shared JS | Expected parity |
| **Team / members list** | ✅ `/team` | ✅ `(app)/team` | ✅ shared JS | Expected parity |
| **Team admin (role, remove, re-invite)** | ✅ `/team/admin` | ❌ | ❌ | **Gap** — admin actions only on web |
| **Settings hub** | 🟡 scattered across panels | ✅ `(app)/settings` | ✅ shared JS | **Gap** — web lacks unified settings page |
| **Billing — manage subscription** | ✅ `/billing`, `/subscriptions` | ❌ no billing UI | ❌ | **Gap (partial)** — IAP policy complexity, see PP-005 |
| **Billing success callback** | ✅ `/billing/success` | — | — | Expected (Stripe redirect is web-only) |
| **Marketing pages** | ✅ `(marketing)/` | — | — | Expected (public web) |
| **Push notifications** | ❌ (no web push yet) | ✅ `expo-notifications` | 🟡 token flow unverified on Android | **Gap** — web push + verify Android |
| **Native camera / image picker** | 🟡 file input fallback | ✅ `expo-camera` / `expo-image-picker` | 🟡 shared JS, not verified | Expected platform tweak |
| **Haptics** | — | ✅ `expo-haptics` | 🟡 shared (supported but unverified) | Expected |
| **watchOS companion** | — | ✅ `modules/carelog-watch/ios` + `watchos/` target | — | Expected (Apple-only) |
| **Wear OS companion** | — | — | ❌ | Intentionally descoped — PP-018 |
| **Deep linking** | ✅ `/invite/[token]` | ✅ `yourcarelog://` + `applinks:yourcarelog.com` | 🟡 intent filter declared but untested | **Gap** — verify Android app links |
| **Sentry** | ✅ | ✅ `@sentry/react-native` | ✅ same JS | Expected parity |
| **PostHog analytics** | ✅ | ✅ `posthog-react-native` | ✅ same JS | Expected parity |
| **Offline queue / sync** | ❌ (online only) | 🟡 `@react-native-community/netinfo` wired | 🟡 shared | **Gap** — offline behavior under-specified |

---

## Summary of Classifications

**Expected differences** (platform idioms, not gaps):
- Web = panels inside `/journal/[recipientId]`; mobile = dedicated screens per feature
- Journal shape (web per-recipient page; mobile flat list + detail)
- Stripe billing flow is web-only
- watchOS companion is Apple-only by definition
- Marketing pages are web-only
- Camera/haptics/push are native-only

**Real gaps** (needing stories):
1. Mobile lacks: explicit onboarding wizard, team admin actions, subscription management view
2. Web lacks: unified settings page, web push, offline policy
3. Android: native project never prebuilt, push/deep-linking unverified, visual QA pass not done
4. Android app-links intent filter declared but never validated end-to-end

---

## Stories

> Format: `PP-NNN` · priority · effort (S/M/L) · acceptance notes.

### Mobile catch-up

- **PP-001** · P1 · M — **Mobile: Team admin actions**
  Mobile team screen shows members only. Add admin capabilities: change role, remove, re-invite. Gate on admin role. AC: functional parity with web `/team/admin`; leverage existing pgTAP coverage.

- **PP-002** · P2 · M — **Mobile: Onboarding wizard**
  First-run flow that explicitly walks through: name household, add first recipient, invite first member. Today it's inline. AC: dedicated `(onboarding)` stack, resumable, skip-to-app option.

- **PP-003** · P2 · M — **Mobile: Subscription management surface**
  Read-only plan + seat count + next bill date + "manage on web" CTA. Full IAP is out of scope for v1 (App Store policy). AC: status card + in-app browser to Stripe portal.

### Web catch-up

- **PP-004** · P1 · S — **Web: Settings hub**
  `/settings` — single page with profile, notification prefs, timezone, language, danger zone. Today it's scattered. AC: unified page with clear sections.

- **PP-005** · P2 · L — **Web: Push notifications**
  Browser Push API (FCM/APNs) for the same events mobile gets: journal entry, schedule change, med reminder. AC: opt-in UI, server-side send, unsubscribe.

### Android

- **PP-006** · P0 · S — **Android: Prebuild + boot verification**
  Run `npx expo prebuild -p android --clean`, decide commit-vs-gitignore (align with `ios/`), verify `pnpm --filter mobile android` boots on emulator. AC: debug APK builds on CI. **Blocks all other Android work.**

- **PP-007** · P1 · S — **Android: Push notification verification**
  Confirm `expo-notifications` registers with FCM, device token posts with `platform: 'android'`, tapping the notification deep-links correctly. AC: end-to-end notification flow green.

- **PP-008** · P1 · S — **Android: App-links verification**
  `app.json` declares the `https://yourcarelog.com/invite` intent filter with `autoVerify: true`. Verify the `/.well-known/assetlinks.json` file is served from the marketing domain and that clicking an invite email on Android opens the app (not Chrome). AC: documented verification, assetlinks file in place.

- **PP-009** · P2 · M — **Android: Visual QA pass**
  Use `./scripts/mobile-ui.sh -p android shot` to screenshot every top-level screen, diff against iOS. Fix elevation-vs-shadow, system-UI overlap, back-gesture issues. AC: PR with side-by-side screenshots, no regressions.

- **PP-010** · P2 · S — **Android: Document share verification**
  `apps/mobile/app/(app)/documents/index.tsx` has `Platform.OS === 'ios'` branches. Verify the Android share intent path actually works. AC: manual test + add to e2e.

### Cross-cutting

- **PP-011** · P2 · L — **Offline behavior spec + implementation**
  Define write-queue semantics on mobile when offline (journal entries, med doses priority). Web stays online-only. AC: design doc + happy-path queue for journal entries.

- **PP-012** · P3 · S — **Consolidate URL scheme**
  `app.json` uses `yourcarelog://` but brand is `carelog`. Align and update `scripts/mobile-ui.sh`. AC: single scheme referenced everywhere.

- **PP-013** · P3 · L — **Wear OS companion (descoped for v1)**
  Explicitly parked. Revisit after iOS watchOS ships.

---

## Scheduling notes

- **PP-006 blocks** PP-007, PP-008, PP-009, PP-010. Do it first.
- **PP-001 and PP-004** are the highest-leverage product-parity items.
- PP-012 and PP-013 are footnotes until someone asks.
