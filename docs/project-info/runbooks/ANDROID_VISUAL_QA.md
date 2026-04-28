# Android Visual-QA Runbook (PP-009)

How to run a full visual-QA sweep on the Android build of the Carelog mobile
app and diff it against the iOS reference. The script is `scripts/android-visual-qa.sh`;
this runbook covers the human steps around it (prereqs, what to flag, how to
file follow-ups).

The QA pass is human-gated — it requires a running Android emulator and the
Expo Dev Client built for Android. Plan ~30–45 minutes of attended time per
sweep.

---

## 1. Prerequisites

1. **Android Studio** installed (Hedgehog 2023.1.1+ or newer).
2. **An AVD running API 34** — recommended profile: Pixel 8 / API 34 (UpsideDownCake).
   Create via Android Studio → Device Manager → Create Device.
3. **`ANDROID_HOME`** exported in your shell (default: `~/Library/Android/sdk`
   on macOS).
4. **Expo Dev Client built for Android** — first-run only:
   ```sh
   cd apps/mobile && npx expo run:android
   ```
   The script cannot install/launch Expo Go automatically; the first run must
   come from a developer build.
5. **Emulator booted and Expo Dev Client launched** before invoking the script.
   The helper handles boot/start:
   ```sh
   ./scripts/mobile-ui.sh -p android boot
   ./scripts/mobile-ui.sh -p android start
   ```
6. **iOS reference screenshots.** As of 2026-04-28, no canonical iOS reference
   set lives in `docs/project-info/screenshots/` (the directory does not exist).
   Capture an iOS reference set first:
   ```sh
   for screen in journal medications schedule documents settings burnout \
                 outer-circle care-brief expenses symptoms eol-planner; do
     ./scripts/mobile-ui.sh -p ios shot "$screen"
   done
   ```
   Save the resulting PNGs into a stable directory (e.g.
   `~/carelog-qa/ios-reference-<YYYY-MM-DD>/`). Pass that directory via
   `--compare` on the next step.

---

## 2. Run the script

```sh
./scripts/android-visual-qa.sh \
  --compare ~/carelog-qa/ios-reference-<YYYY-MM-DD> \
  --out /tmp/carelog-qa/android-visual-qa-$(date +%Y-%m-%d)
```

Useful flags:

- `--skip-boot` — emulator is already running and verified.
- `--no-report` — capture PNGs only, skip the side-by-side HTML report.
- `--help` — full flag list.

Output:

- `<out>/android/<screen>.png` — Android screenshot per screen.
- `<out>/report.html` — side-by-side HTML diff (rendered when `--compare` is
  passed and `--no-report` is not set).

The screen set is defined in `scripts/android-visual-qa.sh` (`SCREENS=` array)
and currently covers: journal, medications, schedule, documents, settings,
burnout, outer-circle, care-brief, expenses, symptoms, eol-planner.

---

## 3. What to flag

Open the report in a browser and walk every pair top-to-bottom. File a row
when any of the following diverge between Android and iOS:

- **Typography drift** — different font weights, sizes, line heights, or the
  display font failing to load (Fraunces fallback to system serif is a bug).
- **Spacing differences** — padding/margin/gap that breaks the design rhythm
  (Tailwind multiples of 4 px). Subtle 1–2 px shifts on inputs are usually
  safe; whole-section reflows are not.
- **Missing icons** — Lucide icons not rendering (square boxes, missing
  glyphs). Often a font-loading or asset-resolution issue.
- **Contrast regressions** — body text or interactive borders below WCAG AA
  on Android that are fine on iOS. Common cause: Material elevation darkening
  the surface tone unexpectedly.
- **Color drift** — token misapplication, wrong theme channel, or
  Material-vs-Cupertino navigation bar tinting.

### Expected platform deviations (do NOT file)

These are intentional Android-platform behaviors that should NOT be flagged:

- **Hardware back button (BackHandler)** — Android navigates back; iOS uses
  swipe-to-go-back. Both are correct.
- **Keyboard avoidance** — Android `windowSoftInputMode` differs from iOS
  `KeyboardAvoidingView`. Layout shifts up to ~50 px on focus are expected.
- **Status bar tinting** — Android matches the screen header; iOS uses the
  global status-bar style. Both correct.
- **System back gestures** — edge swipes on Android trigger the OS back
  gesture, not in-app navigation. Expected.
- **Ripple effects vs. opacity press states** — Material ripple is the
  Android default; iOS uses opacity. Both correct.

---

## 4. Filing follow-ups

For every divergence flagged above, capture a row in a follow-up
`chore(backlog): add A11Y-XX..YY` PR (per CLAUDE.md — never bundle new
backlog rows into a feature/fix PR):

```
- **A11Y-NN** — <Android> <screen> <component>: <diff vs iOS>.
  Status: 🟢 Ready
  Repro: scripts/android-visual-qa.sh report 2026-04-28, screen=<x>
  Refs: <link to report.html screenshot pair>
```

Use the lowest available `A11Y-NN` ID — grep §7 of `BACKLOG.md` first to
avoid collisions (per `docs/project-info/runbooks/HARNESS_USAGE.md`).

For larger drifts (whole-screen redesign needed) file as `UX-NN` instead.

If the report shows **zero** diffs worth filing, capture that explicitly in
the next `chore(backlog): sync` PR by appending a one-line note to the
PP-009 row: `Last QA pass: 2026-04-28 — 0 diffs filed.` This proves the pass
ran without leaving a stale "Pending" status.

---

## 5. Cross-references

- Script: `scripts/android-visual-qa.sh`
- Script entry helper: `scripts/mobile-ui.sh -p android …`
- Mobile rules: `apps/mobile/CLAUDE.md`
- UI standards (cross-platform): `.claude/rules/ui-standards.md`
- Backlog PP-009 row: `BACKLOG.md` §3
