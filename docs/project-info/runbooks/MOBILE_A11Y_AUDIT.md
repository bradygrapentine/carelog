# Mobile Accessibility Audit Runbook (ON-15)

Step-by-step checklist for the Dynamic Type + screen-reader audit that
couldn't be automated. Run this on at least one physical iPhone + one
Android device (or emulator with TalkBack) before the first public
release.

## Setup

### Devices
- **iPhone**: any device on iOS 17+. Enable **Settings → Accessibility
  → Display & Text Size → Larger Text → Larger Accessibility Sizes →
  slider to max (AX5)**.
- **Android**: any device on Android 13+. Enable **Settings →
  Accessibility → Display size and text → Font size → Largest**.

### Screen readers
- **iOS VoiceOver**: Settings → Accessibility → VoiceOver → On. Triple-
  click the side button to toggle quickly.
- **Android TalkBack**: Settings → Accessibility → TalkBack → On.
  Triple-tap with two fingers to toggle.

### Build + install
- `cd apps/mobile && eas build --profile preview --platform ios` (or
  `--platform android`) to get a sharable build.
- Sideload via TestFlight (iOS) or install the APK (Android).

## Part 1 — Dynamic Type / Large Text

Open each screen at max font scale. Record any layout breakage in the
**Findings** section below.

| Screen | Route | Dynamic Type works? | Notes |
|---|---|---|---|
| Sign-in | `/(auth)/sign-in` | ☐ | |
| Verify | `/(auth)/verify` | ☐ | |
| Dashboard | `/(app)` | ☐ | |
| Journal | `/(app)/journal` | ☐ | |
| Journal entry detail | `/(app)/journal/[id]` | ☐ | |
| Medications | `/(app)/medications` | ☐ | |
| Schedule | `/(app)/schedule` | ☐ | |
| Team | `/(app)/team` | ☐ | |
| Settings | `/(app)/settings` | ☐ | |
| More | `/(app)/more` | ☐ | |
| Symptoms list | `/(app)/symptoms` | ☐ | |
| Symptoms log | `/(app)/symptoms/log` | ☐ | |
| Burnout | `/(app)/burnout` | ☐ | |
| Burnout checkin | `/(app)/burnout/checkin` | ☐ | |
| Burnout summary | `/(app)/burnout/summary` | ☐ | |
| Expenses | `/(app)/expenses` | ☐ | |
| Expense add | `/(app)/expenses/add` | ☐ | |
| Documents | `/(app)/documents` | ☐ | |
| Document scan | `/(app)/documents/scan` | ☐ | |
| OCR review | `/(app)/documents/ocr-review/[id]` | ☐ | |
| Outer circle | `/(app)/outer-circle` | ☐ | |
| Care brief | `/(app)/care-brief` | ☐ | |
| Benefits | `/(app)/benefits` | ☐ | |
| EOL planner | `/(app)/eol-planner` | ☐ | |
| Invite accept | `/(app)/invite/[token]` | ☐ | |

**Common breakage patterns to look for:**
- Text truncated (`...`) inside a `<Panel>` header
- Button labels wrap to 3+ lines and push adjacent content off-screen
- Icons misalign with text (icons don't scale, text does)
- Horizontal scroll appears where none should exist
- Fixed-height containers clip text

**Fix pattern:**
- If the text is inside a `Text` component with a hard-coded font size,
  consider wrapping with `PixelRatio.getFontScale()`-aware helper or
  setting `allowFontScaling={true}` explicitly. Default for RN `Text`
  is already `true` but third-party libraries may override.
- For icons that should scale proportionally with text, compute
  `iconSize = baseSize * PixelRatio.getFontScale()` capped at a max.
- For fixed-height containers, either remove the hard height or raise
  the cap so it still accommodates AX5.

## Part 2 — Screen reader (VoiceOver / TalkBack)

Goal: a sighted-free user can complete the **Log a medication** and
**Submit a journal entry** flows end-to-end.

### Journal entry flow
1. Open app with VoiceOver/TalkBack active.
2. Verify the tab bar is reachable via swipe-right and each tab
   announces its label ("Journal, tab, 1 of 6" etc.).
3. Open Journal tab.
4. Swipe to the entry text box — it should announce as "Journal entry
   input, text field" with any placeholder.
5. Type (use the on-screen keyboard — VoiceOver passes keystrokes).
6. Swipe to the submit button — should announce "Add entry, button".
7. Double-tap to submit.
8. Verify success is announced (VoiceOver reads any new content that
   scrolls into view; TalkBack similar).

### Medication log flow
1. Open Medications tab.
2. Swipe through the scheduled-doses list.
3. Each dose item should announce drug name + time + current status
   ("Lisinopril 10 mg, 9:00 AM, pending").
4. Focus the "Mark as given" button (or equivalent) and verify it
   announces "Mark as given, button".
5. Double-tap → verify the status announces as updated.

### Record findings

Anything that's silent, says "button" without a label, or makes focus
order nonsensical is a bug. File follow-ups as ON-XX in the
BACKLOG.md.

## Part 3 — Contrast + color-only information

- Turn the phone to **grayscale** (iOS: Settings → Accessibility →
  Display & Text Size → Color Filters → Grayscale; Android: Settings →
  Accessibility → Color correction → Grayscale).
- Walk the same flows. Any state that used color alone to convey
  meaning (flagged entry red dot, mood indicator, low-supply amber) is
  now invisible. Those need secondary cues (icon, text label).

## Findings template

```
## YYYY-MM-DD audit — tester: [name]

### Dynamic Type at AX5 on iPhone 15 Pro
- [screen]: [what broke, file path, suggested fix]
...

### VoiceOver
- [flow]: [what was broken]
...

### Grayscale
- [screen]: [what color-only signal was lost]
...
```

Paste findings into a GitHub issue tagged `a11y` and link from the
BACKLOG.md ON-15 entry.
