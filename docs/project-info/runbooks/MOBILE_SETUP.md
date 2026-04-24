# Carelog — Mobile Setup Runbook

Human-only steps for the Expo / React Native mobile app. Every step here requires logging into a dashboard or running an interactive CLI that Claude cannot run.

**Related docs:**
- [`THIRD_PARTY_SETUP.md`](./THIRD_PARTY_SETUP.md) §10–12 — Firebase, APNs, deep-link verification files (canonical; this doc cross-links, doesn't duplicate)
- [`ENV_VARS.md`](./ENV_VARS.md) — all mobile env vars in one table
- [`DEPLOYMENT.md`](./DEPLOYMENT.md) — production build + submit flow

**App config facts** (from `apps/mobile/app.json`):

| Field | Value |
|---|---|
| Bundle ID (iOS) | `com.carelog.app` |
| Package (Android) | `com.carelog.app` |
| Expo slug | `carelog` |
| URL scheme | `yourcarelog` |
| Associated domain | `applinks:yourcarelog.com` |

> **Note:** The associated domain in `app.json` references `yourcarelog.com` — if the production domain is `care-log.org`, you'll need to update `ios.associatedDomains` and the Android `intentFilters.data.host` in `app.json` before your first EAS build. This is a known gap.

---

## Table of Contents

- [§1 Prerequisites](#1-prerequisites)
- [§2 Apple Developer account](#2-apple-developer-account) — ~15 min
- [§3 APNs push key](#3-apns-push-key) — ~10 min
- [§4 Firebase / FCM (Android push)](#4-firebase--fcm-android-push) — ~20 min
- [§5 EAS project setup](#5-eas-project-setup) — ~10 min
- [§6 Universal links / deep links](#6-universal-links--deep-links) — ~30 min
- [§7 TestFlight setup (iOS)](#7-testflight-setup-ios) — ~15 min
- [§8 Play Store internal testing (Android)](#8-play-store-internal-testing-android) — ~15 min
- [§9 VAPID keys (web push)](#9-vapid-keys-web-push)
- [§10 Local mobile dev](#10-local-mobile-dev)
- [§11 How to verify end-to-end](#11-how-to-verify-end-to-end)

---

## 1. Prerequisites

```bash
# EAS CLI (run once on your machine)
npm install -g eas-cli

# Log in — INTERACTIVE, run manually
eas login
```

You'll need:
- An Apple Developer account ($99/yr) enrolled in the Apple Developer Program
- A Google Play Developer account ($25 one-time)
- A Firebase project (free tier is fine)
- An Expo account (free)

---

## 2. Apple Developer account

**Estimated time: ~15 min (or more if enrollment is pending review)**

1. Go to [developer.apple.com](https://developer.apple.com) → **Account**
2. Enroll in the Apple Developer Program if not already
3. Note your **Team ID** — found under Account → Membership Details. You'll need it for the AASA file in §6.
4. Go to **Certificates, Identifiers & Profiles** → **Identifiers**
5. Register App ID `com.carelog.app`:
   - Description: `Carelog`
   - Bundle ID: `com.carelog.app` (explicit)
   - Capabilities: enable **Push Notifications**, **Associated Domains**
6. Click **Continue** → **Register**

**How to verify:** The App ID `com.carelog.app` appears in Identifiers list with Push Notifications enabled.

---

## 3. APNs push key

**Estimated time: ~10 min**

See also: THIRD_PARTY_SETUP.md §11.

1. [developer.apple.com](https://developer.apple.com) → **Certificates, Identifiers & Profiles** → **Keys**
2. Click **+** → name it `CarelogAPNs` → enable **Apple Push Notifications service (APNs)**
3. Click **Continue** → **Register** → **Download** (`.p8` file — download once, store safely)
4. Note the **Key ID** shown on the confirmation screen
5. Upload to EAS — **INTERACTIVE**:
   ```bash
   eas credentials
   # Select: iOS → production → Push Notifications → Add key
   # Follow the prompts to upload the .p8 file
   ```

**How to verify:** After an EAS build and install on a real iOS device, send a test push from the Expo dashboard — the device should receive it.

---

## 4. Firebase / FCM (Android push)

**Estimated time: ~20 min**

See also: THIRD_PARTY_SETUP.md §10.

1. [console.firebase.google.com](https://console.firebase.google.com) → **Add project** → name `carelog` → disable Google Analytics
2. Click **Add app** → select the Android icon
3. Package name: `com.carelog.app`
4. App nickname: `Carelog Android`
5. Click **Register app** → download `google-services.json` → save to `apps/mobile/google-services.json`
6. Firebase → **Project settings** → **Cloud Messaging** → copy the **Server key**
7. Upload to EAS as a secret:
   ```bash
   eas secret:create --scope project --name FCM_SERVER_KEY --value "<server-key>"
   ```
8. Verify `eas.json` has `"googleServicesFile": "./google-services.json"` under the Android production build profile. If `eas.json` doesn't exist yet, create it (see §5).

**How to verify:** After an EAS build, send a test notification from Firebase console → device receives it.

---

## 5. EAS project setup

**Estimated time: ~10 min**

```bash
# In the apps/mobile directory
cd apps/mobile
eas build:configure   # INTERACTIVE — creates eas.json, links to Expo project
```

If `eas.json` doesn't exist, the above creates it. Minimum recommended `eas.json`:

```json
{
  "cli": { "version": ">= 5.0.0" },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal"
    },
    "preview": {
      "distribution": "internal"
    },
    "production": {
      "android": {
        "googleServicesFile": "./google-services.json"
      }
    }
  },
  "submit": {
    "production": {}
  }
}
```

**How to verify:** `eas build:list` shows the project linked to your Expo account.

---

## 6. Universal links / deep links

**Estimated time: ~30 min (plus DNS propagation time)**

Deep links allow the app to open when a user taps an invite link in a browser or email.

### iOS — AASA file

See also: THIRD_PARTY_SETUP.md §12.

The AASA file must be served at `https://<your-domain>/.well-known/apple-app-site-association` with no `.json` extension and `Content-Type: application/json`.

Replace `TEAMID` with your Apple Team ID from §2:

File: `apps/web/public/.well-known/apple-app-site-association`
```json
{
  "applinks": {
    "apps": [],
    "details": [
      {
        "appID": "<TEAMID>.com.carelog.app",
        "paths": ["/invite/*"]
      }
    ]
  }
}
```

After deploying to Vercel, verify:
```bash
curl -s https://care-log.org/.well-known/apple-app-site-association | python3 -m json.tool
```

### Android — assetlinks.json

The assetlinks file must be served at `https://<your-domain>/.well-known/assetlinks.json`.

You need the **SHA-256 fingerprint** from your EAS build signing certificate. After your first production EAS build:
```bash
eas credentials
# Select: Android → production → Keystore → View
# Copy the SHA-256 fingerprint
```

File: `apps/web/public/.well-known/assetlinks.json`
```json
[
  {
    "relation": ["delegate_permission/common.handle_all_urls"],
    "target": {
      "namespace": "android_app",
      "package_name": "com.carelog.app",
      "sha256_cert_fingerprints": ["<SHA-256-from-EAS>"]
    }
  }
]
```

> **PP-008 blocker:** This step is gated on having a live production domain AND a completed EAS build. The SHA-256 fingerprint only exists after the first EAS production build creates a keystore.

**How to verify:**
```bash
# iOS — use Apple's AASA validator
curl -s "https://app-site-association.cdn-apple.com/a/v1/care-log.org"

# Android — check the domain association
adb shell pm get-app-links com.carelog.app
```

---

## 7. TestFlight setup (iOS)

**Estimated time: ~15 min**

1. [appstoreconnect.apple.com](https://appstoreconnect.apple.com) → **Apps** → **+** → **New App**
   - Platform: iOS
   - Name: `Carelog`
   - Bundle ID: `com.carelog.app`
   - SKU: `carelog-ios`
2. Submit a build via EAS — **INTERACTIVE, run manually**:
   ```bash
   eas build --platform ios --profile production --auto-submit
   ```
3. After processing, go to App Store Connect → TestFlight → add internal testers (your Apple ID)
4. Testers receive an email invite; install via TestFlight app

**How to verify:** TestFlight app on iPhone shows the Carelog build; install succeeds.

---

## 8. Play Store internal testing (Android)

**Estimated time: ~15 min**

1. [play.google.com/console](https://play.google.com/console) → **Create app**
   - App name: `Carelog`
   - Default language: English (US)
   - App type: App
2. Submit a build via EAS — **INTERACTIVE, run manually**:
   ```bash
   eas build --platform android --profile production --auto-submit
   ```
3. App Store Connect → Internal testing → Create release → upload the `.aab` from EAS
4. Add testers by email → publish to internal testing track

**How to verify:** Tester receives Play Store invite link; app installs successfully.

---

## 9. VAPID keys (web push)

VAPID keys are shared between web and mobile push. They live in THIRD_PARTY_SETUP.md §9 — don't generate separate keys for mobile.

Cross-link: [THIRD_PARTY_SETUP.md §9](./THIRD_PARTY_SETUP.md#9-vapid-keys-web-push)

---

## 10. Local mobile dev

```bash
# Start the Expo dev server
pnpm mobile   # runs: pnpm --filter mobile start

# Or directly:
cd apps/mobile && npx expo start

# iOS Simulator
npx expo start --ios

# Android emulator
npx expo start --android
```

**Supabase local:** Set `EXPO_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321` in `apps/mobile/.env.local`. If testing on a real device (not simulator), use your machine's local IP instead of `127.0.0.1`.

---

## 11. How to verify end-to-end

| Feature | How to verify |
|---|---|
| iOS push notifications | Send test from Expo dashboard → real iOS device receives it |
| Android push notifications | Send test from Firebase console → real Android device receives it |
| Deep link (invite) | Tap an invite URL in Safari/Chrome on device → app opens to invite screen |
| Universal link (iOS) | Tap `https://yourcarelog.com/invite/xxx` → app opens (not browser) |
| App link (Android) | Tap `https://yourcarelog.com/invite/xxx` → app opens (not browser) |
| TestFlight install | TestFlight invite email → install → sign in with OTP → dashboard visible |
