---
name: mobile-ui
description: Drive the iOS Simulator to investigate the Carelog mobile UI — boot sim, launch Expo, deep-link to routes, capture screenshots, toggle light/dark. Use for design review, visual regression checks, reproducing UI bugs, or testing new screens in apps/mobile/.
---

# Mobile UI Investigation

Automates the manual Expo + iOS Simulator loop. Claude drives the sim via `scripts/mobile-ui.sh` and reads screenshots back with the Read tool (multimodal) to actually *see* the UI.

## When to use

- User asks to "check", "look at", "review", "screenshot", or "test" a mobile screen
- Reproducing a mobile UI bug
- Verifying a design change in `apps/mobile/`
- Comparing light/dark appearance
- Any mobile UI task where seeing the rendered screen would answer the question

## Workflow

1. **Boot + start** (once per session):
   ```bash
   ./scripts/mobile-ui.sh boot            # iPhone 16 Pro by default
   ./scripts/mobile-ui.sh start           # launches Expo + installs app (30-60s first time)
   ```
   Poll `./scripts/mobile-ui.sh logs 40` until you see `Metro waiting` and the app has installed. If it stalls, report and stop — do not retry silently.

2. **Navigate** to the screen under investigation:
   ```bash
   ./scripts/mobile-ui.sh route /journal
   ./scripts/mobile-ui.sh route /(tabs)/care
   ```
   Uses the `carelog://` scheme registered in `app.json`.

3. **Capture**:
   ```bash
   ./scripts/mobile-ui.sh shot journal-empty
   # → /tmp/carelog-ui/journal-empty-20260414-091233.png
   ```
   Then `Read` that path — the image is fed back to you as a visual.

4. **Iterate**: edit code → Expo hot-reloads → `shot again` → Read. Do NOT restart Expo between edits.

5. **Variants** worth checking for design work:
   - `./scripts/mobile-ui.sh appearance dark` then re-shot
   - Different device: `./scripts/mobile-ui.sh boot 'iPhone SE (3rd generation)'` (stop first, then boot)

6. **Cleanup**: `./scripts/mobile-ui.sh stop` at end of session (or leave running — skill is idempotent).

## Rules

- **Always `Read` the screenshot** after `shot`. The path alone is useless — you need to see the image to judge the UI.
- **Label shots meaningfully** (`journal-empty`, `med-form-validation-error`) — you'll re-reference them.
- **Don't screenshot the Expo splash or red error screen** as the answer — wait for the real screen or tail logs and report the error.
- **First `start` is slow** (native build + install). Tell the user. Subsequent starts reuse the installed app.
- **If simulator won't boot**: check `xcrun simctl list devices available` for device names and retry. Don't `killall Simulator` without asking.
- **macOS only**. If platform isn't Darwin, report and stop — there is no Android path in this skill yet.

## Non-goals

- Not a substitute for Jest/Testing Library unit tests — use this for *visual* verification only.
- Not for E2E flows with assertions — that's Maestro's job (not wired yet).
- Does not exercise the WatchOS target.

## Quick reference

| Need | Command |
|------|---------|
| Boot default device | `./scripts/mobile-ui.sh boot` |
| Start Expo + install app | `./scripts/mobile-ui.sh start` |
| Deep link to route | `./scripts/mobile-ui.sh route /journal` |
| Screenshot | `./scripts/mobile-ui.sh shot <label>` |
| Toggle dark mode | `./scripts/mobile-ui.sh appearance dark` |
| Tail Expo log | `./scripts/mobile-ui.sh logs 100` |
| Status check | `./scripts/mobile-ui.sh status` |
| Stop Expo | `./scripts/mobile-ui.sh stop` |
