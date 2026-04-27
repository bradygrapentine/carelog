# Mobile Release Runbook

Carelog mobile uses Expo EAS Build + EAS Update. Builds flow through three channels:
`development` (dev client, internal distribution) → `preview` (internal APK/IPA, QA)
→ `production` (App Store / Play Store, OTA updates gated to this channel only).
Builds in the `production` channel only receive OTA updates published to `--branch production`,
ensuring preview and development devices are never inadvertently updated.

---

## Pre-requisites (human-only steps)

- `eas login` — **interactive, must be run by a human in a terminal**; Claude cannot execute this.
- Apple Developer / Google Play credentials configured in EAS dashboard.
- `PLACEHOLDER_EAS_PROJECT_ID` in `app.json` replaced with the real EAS project ID after running
  `eas update:configure` (also interactive — run manually once per project).

---

## Build (all platforms, production)

```sh
eas build --platform all --profile production
```

This triggers an EAS Build for iOS (App Store) and Android (Play Store).
`autoIncrement: true` bumps the build number/version code automatically.
Both platforms use `image: latest` (EAS-managed Xcode / Android SDK).

---

## Submit to stores

```sh
eas submit --platform all --profile production
```

Requires:
- iOS: `ascAppId` and `appleTeamId` set in `eas.json` submit → production → ios (currently placeholders).
- Android: `play-service-account.json` present at repo root (gitignored; stored in 1Password).

---

## OTA update (JS-only change, no native rebuild needed)

```sh
eas update --branch production --message "describe the change"
```

Builds in the `production` channel will download this update on next app launch.
Only publish to `--branch production` for production users; use `--branch preview` for QA.

---

## When to bump `version` in `app.json`

`runtimeVersion` is derived from `version` (`policy: "appVersion"`). The policy controls
which OTA updates are compatible with which binary:

| Change type | Action |
|---|---|
| Pure JS / React change | No version bump — OTA update is compatible |
| New native module, SDK upgrade, or native config change | Bump `version` in `app.json` → triggers new binary build; old binaries will not receive the incompatible OTA |

Rule of thumb: if `expo prebuild` would generate different native code, bump `version`.

---

## OTA gating — how it works

- `production` EAS builds are pinned to `channel: "production"` in `eas.json`.
- `eas update --branch production` publishes only to that channel.
- `preview` builds listen to `channel: "preview"` and are never promoted to production automatically.
- `app.json` → `updates.checkAutomatically: "ON_LOAD"` means the app checks for an update every cold launch and applies it before rendering (with `fallbackToCacheTimeout: 0` for instant fallback).

---

## Checklist before production release

- [ ] `version` bumped in `app.json` if any native change is included
- [ ] `eas build --platform all --profile production` completed green
- [ ] QA sign-off on preview build
- [ ] `eas submit --platform all --profile production` submitted
- [ ] Stores reviewed and approved
- [ ] `eas update --branch production --message "vX.Y.Z release"` published after store approval
