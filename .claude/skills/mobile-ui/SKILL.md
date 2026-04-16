---
name: mobile-ui
description: Drive the iOS Simulator OR Android emulator to investigate the Carelog mobile UI — boot device, launch Expo, deep-link to routes, capture screenshots, toggle light/dark, enable VoiceOver/TalkBack for accessibility narration testing. Use for design review, visual regression checks, reproducing UI bugs, accessibility audits, or testing new screens in apps/mobile/.
---

# Mobile UI Investigation

Automates the manual Expo + Simulator/Emulator loop on both platforms. Claude drives the device via `scripts/mobile-ui.sh` and reads screenshots back with the Read tool (multimodal) to actually *see* the UI.

Platform is selected with `-p ios|android` (default `ios`).

## When to use

- User asks to "check", "look at", "review", "screenshot", or "test" a mobile screen
- Reproducing a mobile UI bug
- Verifying a design change in `apps/mobile/`
- Comparing light/dark appearance, or iOS vs Android rendering
- Side-by-side platform QA (screenshot same route on both, compare)
- Accessibility audit: checking VoiceOver (iOS) or TalkBack (Android) narration order, focus rings, and label coverage

## First-time setup check

Always run doctor before touching a new platform — it reports exactly what's missing:

```bash
./scripts/mobile-ui.sh -p ios doctor
./scripts/mobile-ui.sh -p android doctor
```

Requirements:
- **iOS**: full Xcode.app (not just command-line tools — `simctl` ships with Xcode).
- **Android**: Android Studio → SDK + Platform-Tools + at least one AVD. Sets `ANDROID_HOME=~/Library/Android/sdk` by default. Also requires `apps/mobile/android/` — run `npx expo prebuild -p android --clean` from `apps/mobile/` if missing (tracked as story **PP-006** in `docs/project-info/product/PLATFORM_PARITY.md`).

If doctor fails, report the failure to the user and stop — do not try to install SDKs.

## Workflow

1. **Boot + start** (per platform, once per session):
   ```bash
   ./scripts/mobile-ui.sh -p ios boot            # default iPhone 16 Pro
   ./scripts/mobile-ui.sh -p ios start           # launches Expo + installs app (30-60s first time)

   ./scripts/mobile-ui.sh -p android boot        # picks first AVD
   ./scripts/mobile-ui.sh -p android start
   ```
   Poll `./scripts/mobile-ui.sh -p <plat> logs 40` until Metro is ready and the app is installed. If it stalls, stop and report — do not retry silently.

2. **Navigate** via deep link (scheme `yourcarelog://` from `app.json`):
   ```bash
   ./scripts/mobile-ui.sh -p ios route /journal
   ./scripts/mobile-ui.sh -p android route /(tabs)/care
   ```

3. **Capture**:
   ```bash
   ./scripts/mobile-ui.sh -p ios shot journal-empty
   ./scripts/mobile-ui.sh -p android shot journal-empty
   # → /tmp/carelog-ui/<platform>-<label>-<ts>.png
   ```
   Then `Read` the PNG. The path alone is useless — you need to see the image.

4. **Iterate**: edit code → Expo hot-reloads both devices → `shot` again → Read. Do NOT restart Expo between edits.

5. **Variants** worth checking:
   - Dark mode: `./scripts/mobile-ui.sh -p ios appearance dark`
   - Different iOS device: stop Expo, `boot 'iPhone SE (3rd generation)'`
   - Narrower Android: pick a lower-res AVD via `boot <avd-name>`

6. **Cross-platform parity check**: screenshot the same route on both platforms, then compare side-by-side. This is the canonical workflow for PP-009 (Android visual QA pass).

7. **VoiceOver / TalkBack** — accessibility narration audit:
   ```bash
   # Enable screen reader
   ./scripts/mobile-ui.sh -p ios a11y on       # VoiceOver (iOS)
   ./scripts/mobile-ui.sh -p android a11y on   # TalkBack (Android)

   # Navigate to a route, then capture — VoiceOver focus ring appears in screenshot
   ./scripts/mobile-ui.sh -p ios route /journal
   ./scripts/mobile-ui.sh -p ios shot journal-vo

   # Android: dump UI hierarchy XML (reads element labels + roles)
   ./scripts/mobile-ui.sh -p android a11y dump  # → /tmp/carelog-ui/android-a11y-<ts>.xml

   # Disable when done
   ./scripts/mobile-ui.sh -p ios a11y off
   ./scripts/mobile-ui.sh -p android a11y off
   ```
   **Workflow**: enable → deep-link to target route → `shot` → `Read` screenshot → verify focus
   ring order and badge labels → fix any missing `accessible`, `accessibilityLabel`, or
   `accessibilityRole` props → hot-reload → `shot` again to confirm.

   **iOS notes**: VoiceOver on a simulator does not narrate aloud; the focus highlight
   (black outline) in the screenshot shows which element is currently selected. Swipe to
   advance focus is not scriptable — use the screenshot + element order in code to reason
   about narration order.

   **Android notes**: `dump` writes `android-a11y-<ts>.xml` — `Read` it to inspect `content-desc`
   and `class` attributes for every element, which maps to TalkBack announcement order.

8. **Cleanup**: `./scripts/mobile-ui.sh -p <plat> stop` at end of session (emulator/sim keep running; kill manually if needed).

## Rules

- **Always `Read` the screenshot after `shot`**. The path alone is useless.
- **Label shots meaningfully** (`ios-journal-empty`, `android-journal-empty`) — you'll re-reference them for compares.
- **Don't screenshot the Expo splash or red error screen** as the answer — wait for the real screen or tail logs and report the error.
- **First `start` is slow** (native build + install). Warn the user. Subsequent starts reuse the installed app.
- **If boot fails**: run `doctor`, don't retry silently.
- **Android requires prebuilt native project**. If `apps/mobile/android/` is missing, `start` will fail with a pointer to PP-006. Do not try to generate it without authorization — it creates a large checked-in directory.

## Non-goals

- Not a substitute for Jest / Testing Library unit tests — use this for *visual* verification only.
- Not for E2E flows with assertions — that's Maestro's job (not wired yet).
- Does not exercise the watchOS target.

## Quick reference

| Need | Command |
|------|---------|
| Check prerequisites | `./scripts/mobile-ui.sh -p ios doctor` / `-p android doctor` |
| Boot default device | `./scripts/mobile-ui.sh -p <plat> boot` |
| Start Expo + install app | `./scripts/mobile-ui.sh -p <plat> start` |
| Deep link to route | `./scripts/mobile-ui.sh -p <plat> route /journal` |
| Screenshot | `./scripts/mobile-ui.sh -p <plat> shot <label>` |
| Toggle dark mode | `./scripts/mobile-ui.sh -p <plat> appearance dark` |
| Enable VoiceOver / TalkBack | `./scripts/mobile-ui.sh -p <plat> a11y on` |
| Disable VoiceOver / TalkBack | `./scripts/mobile-ui.sh -p <plat> a11y off` |
| Dump Android a11y tree (XML) | `./scripts/mobile-ui.sh -p android a11y dump` |
| Capture iOS VoiceOver screenshot | `./scripts/mobile-ui.sh -p ios a11y dump` |
| Tail Expo log | `./scripts/mobile-ui.sh -p <plat> logs 100` |
| Status | `./scripts/mobile-ui.sh -p <plat> status` |
| Stop Expo | `./scripts/mobile-ui.sh -p <plat> stop` |
