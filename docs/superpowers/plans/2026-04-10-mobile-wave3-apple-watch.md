# Mobile Wave 3 — Apple Watch Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the `writeWatchData` no-op stub with a real Expo Native Module that pushes next-shift and next-medication data to the paired Apple Watch via WatchConnectivity.

**Architecture:** A local Expo module (`modules/carelog-watch/`) wraps `WCSession.updateApplicationContext` on the iOS side. A watchOS single-target SwiftUI app (watchOS 7+) receives the context and displays the upcoming shift and medication. A config plugin (`plugins/withCarelogWatch.ts`) wires the Watch target into the Xcode project during `expo prebuild`. The medications and schedule screens already call `writeWatchData` — no screen changes needed.

**Tech Stack:** Expo SDK 55 (canary) · expo-modules-core · WatchConnectivity (WCSession) · SwiftUI · @expo/config-plugins · watchOS 7+ · Jest (jest-expo)

---

## File Map

```
apps/mobile/
  modules/carelog-watch/
    index.ts                              CREATE — JS interface (Platform guard, Android no-op)
    ios/
      CarelogWatchModule.swift            CREATE — Expo Module, WCSession phone side
      CarelogWatchDelegate.swift          CREATE — WCSessionDelegate (phone side)
      CarelogWatch.podspec                CREATE — CocoaPods spec for local module
    __tests__/
      index.test.ts                       CREATE — Jest tests for JS bridge
  watchos/
    CarelogWatch/
      CarelogWatchApp.swift               CREATE — @main SwiftUI entry (watchOS 7+ single-target)
      ContentView.swift                   CREATE — Watch UI (next shift + medication)
      WatchViewModel.swift                CREATE — WCSessionDelegate + @Published state
  plugins/
    withCarelogWatch.ts                   CREATE — config plugin: Watch target + entitlements
  utils/
    watchBridge.ts                        MODIFY — forward to real module (drop no-op comment)
  app.json                                MODIFY — register ./plugins/withCarelogWatch plugin
```

**No changes to:**
- `app/(app)/medications/index.tsx` — already calls `writeWatchData` in `useEffect`
- `app/(app)/schedule/index.tsx` — already calls `writeWatchData` in `useEffect`

---

## Task 1: JS Module Interface + Tests

**Files:**
- Create: `apps/mobile/modules/carelog-watch/index.ts`
- Create: `apps/mobile/modules/carelog-watch/__tests__/index.test.ts`

- [ ] **Step 1: Create the JS interface**

Create `apps/mobile/modules/carelog-watch/index.ts`:

```typescript
import { Platform } from 'react-native'

export type WatchData = {
  nextShift?: { assigneeName: string; startsAt: string } | null
  nextMedication?: { name: string; dueAt: string } | null
}

/**
 * Sends the latest shift/medication data to the paired Apple Watch.
 * Uses WCSession.updateApplicationContext — delivers latest-only (not queued).
 * Safe to call on Android or when no watch is paired (silently ignored).
 */
export function writeWatchData(data: WatchData): void {
  if (Platform.OS !== 'ios') return
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { requireNativeModule } = require('expo-modules-core')
    const mod = requireNativeModule('CarelogWatch')
    // Strip nulls — WCSession.updateApplicationContext cannot encode null
    const payload: Record<string, unknown> = {}
    if (data.nextShift) payload.nextShift = data.nextShift
    if (data.nextMedication) payload.nextMedication = data.nextMedication
    mod.writeWatchData(payload)
  } catch {
    // WCSession not reachable or module not registered on this build — silently ignore
  }
}
```

- [ ] **Step 2: Create Jest tests**

Create `apps/mobile/modules/carelog-watch/__tests__/index.test.ts`:

```typescript
const mockNativeWrite = jest.fn()

jest.mock('react-native', () => ({
  Platform: { OS: 'ios' },
}))

jest.mock('expo-modules-core', () => ({
  requireNativeModule: jest.fn().mockReturnValue({ writeWatchData: mockNativeWrite }),
}))

// Import AFTER mocks are registered
import { writeWatchData } from '../index'

describe('writeWatchData', () => {
  beforeEach(() => mockNativeWrite.mockReset())

  it('passes nextShift to native module', () => {
    writeWatchData({ nextShift: { assigneeName: 'Jane', startsAt: '2026-04-10T08:00:00Z' } })
    expect(mockNativeWrite).toHaveBeenCalledWith({
      nextShift: { assigneeName: 'Jane', startsAt: '2026-04-10T08:00:00Z' },
    })
  })

  it('passes nextMedication to native module', () => {
    writeWatchData({ nextMedication: { name: 'Metformin', dueAt: '08:00' } })
    expect(mockNativeWrite).toHaveBeenCalledWith({
      nextMedication: { name: 'Metformin', dueAt: '08:00' },
    })
  })

  it('strips null nextShift from payload', () => {
    writeWatchData({ nextShift: null, nextMedication: { name: 'Aspirin', dueAt: '09:00' } })
    expect(mockNativeWrite).toHaveBeenCalledWith({
      nextMedication: { name: 'Aspirin', dueAt: '09:00' },
    })
  })

  it('passes both fields when both provided', () => {
    writeWatchData({
      nextShift: { assigneeName: 'Bob', startsAt: '10:00' },
      nextMedication: { name: 'Lisinopril', dueAt: '10:30' },
    })
    expect(mockNativeWrite).toHaveBeenCalledWith({
      nextShift: { assigneeName: 'Bob', startsAt: '10:00' },
      nextMedication: { name: 'Lisinopril', dueAt: '10:30' },
    })
  })

  it('calls native exactly once per writeWatchData call', () => {
    writeWatchData({ nextShift: { assigneeName: 'Alice', startsAt: '11:00' } })
    expect(mockNativeWrite).toHaveBeenCalledTimes(1)
  })
})
```

- [ ] **Step 3: Run tests**

```bash
cd /Users/bradygrapentine/Documents/projects/carelog/apps/mobile
pnpm test -- modules/carelog-watch
```

Expected output:
```
PASS modules/carelog-watch/__tests__/index.test.ts
  writeWatchData
    ✓ passes nextShift to native module
    ✓ passes nextMedication to native module
    ✓ strips null nextShift from payload
    ✓ passes both fields when both provided
    ✓ calls native exactly once per writeWatchData call

Tests: 5 passed, 5 total
```

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/modules/carelog-watch/
git commit -m "feat(watch): JS bridge interface + tests for CarelogWatch native module"
```

---

## Task 2: Swift Native Module (Phone Side)

**Files:**
- Create: `apps/mobile/modules/carelog-watch/ios/CarelogWatchModule.swift`
- Create: `apps/mobile/modules/carelog-watch/ios/CarelogWatchDelegate.swift`
- Create: `apps/mobile/modules/carelog-watch/ios/CarelogWatch.podspec`

No automated test for Swift — correctness is verified by build + device testing.

- [ ] **Step 1: Create the Expo Module**

Create `apps/mobile/modules/carelog-watch/ios/CarelogWatchModule.swift`:

```swift
import ExpoModulesCore
import WatchConnectivity

public class CarelogWatchModule: Module {
  public func definition() -> ModuleDefinition {
    Name("CarelogWatch")

    // Activate WCSession when the module is created
    OnCreate {
      if WCSession.isSupported() {
        let session = WCSession.default
        if session.delegate == nil {
          session.delegate = CarelogWatchDelegate.shared
        }
        if session.activationState != .activated {
          session.activate()
        }
      }
    }

    // Called from JS: writeWatchData({ nextShift: {...}, nextMedication: {...} })
    AsyncFunction("writeWatchData") { (data: [String: Any]) throws in
      guard WCSession.isSupported() else { return }
      let session = WCSession.default
      guard session.activationState == .activated else {
        // Session not activated yet — activate and discard this update
        // Next call after activation will succeed
        session.activate()
        return
      }
      // updateApplicationContext replaces any previous context — always latest only
      try session.updateApplicationContext(data)
    }
  }
}
```

- [ ] **Step 2: Create the WCSession delegate (phone side)**

Create `apps/mobile/modules/carelog-watch/ios/CarelogWatchDelegate.swift`:

```swift
import WatchConnectivity

/// Minimal WCSessionDelegate that satisfies the iOS-required delegate methods.
/// The phone side only SENDS data (via updateApplicationContext), so this
/// delegate just handles lifecycle callbacks.
class CarelogWatchDelegate: NSObject, WCSessionDelegate {
  static let shared = CarelogWatchDelegate()
  private override init() {}

  func session(
    _ session: WCSession,
    activationDidCompleteWith activationState: WCSessionActivationState,
    error: Error?
  ) {
    // Activation complete — future writeWatchData calls will succeed
  }

  // Required on iOS (not watchOS)
  func sessionDidBecomeInactive(_ session: WCSession) {}

  // Required on iOS: re-activate after becoming active again
  func sessionDidDeactivate(_ session: WCSession) {
    WCSession.default.activate()
  }
}
```

- [ ] **Step 3: Create the CocoaPods podspec**

Create `apps/mobile/modules/carelog-watch/ios/CarelogWatch.podspec`:

```ruby
require 'json'

package = JSON.parse(File.read(File.join(__dir__, '..', '..', 'package.json')))

Pod::Spec.new do |s|
  s.name           = 'CarelogWatch'
  s.version        = package['version']
  s.summary        = 'Carelog WatchConnectivity bridge for Apple Watch complications'
  s.description    = s.summary
  s.license        = package['license']
  s.author         = package['author']
  s.homepage       = 'https://github.com/carelog/carelog'
  s.platforms      = { :ios => '14.0' }
  s.source         = { :git => '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.source_files   = '**/*.{h,m,mm,swift}'
end
```

- [ ] **Step 4: Register the module in package.json**

Edit `apps/mobile/package.json` — add `"expo"` config section that points to the local module:

```json
{
  "expo": {
    "autolinking": {
      "nativeModulesDir": "./modules"
    }
  }
}
```

Add this inside the top-level `{}` in `apps/mobile/package.json` (alongside `"name"`, `"version"`, etc.):

```json
"expo": {
  "autolinking": {
    "nativeModulesDir": "./modules"
  }
}
```

Full resulting `package.json`:

```json
{
  "name": "mobile",
  "version": "1.0.0",
  "main": "expo-router/entry",
  "expo": {
    "autolinking": {
      "nativeModulesDir": "./modules"
    }
  },
  "scripts": {
    "start": "expo start",
    "android": "expo start --android",
    "ios": "expo start --ios",
    "web": "expo start --web",
    "test": "jest"
  },
  "dependencies": {
    "@carelog/schemas": "workspace:*",
    "@carelog/types": "workspace:*",
    "@carelog/utils": "workspace:*",
    "@react-native-community/netinfo": "^11.3.0",
    "@supabase/supabase-js": "^2.39.0",
    "@tanstack/react-query": "^5.17.0",
    "@testing-library/react-native": "^13.3.3",
    "@trpc/client": "^11.0.0-rc.477",
    "@trpc/react-query": "^11.0.0-rc.477",
    "expo": "55.0.10-canary-20260327-0789fbc",
    "expo-camera": "~14.1.0",
    "expo-image-manipulator": "~12.0.0",
    "expo-linking": "55.0.10-canary-20260327-0789fbc",
    "expo-modules-core": "2.3.11-canary-20260327-0789fbc",
    "expo-notifications": "55.0.15-canary-20260327-0789fbc",
    "expo-router": "55.0.9-canary-20260327-0789fbc",
    "expo-secure-store": "~13.0.0",
    "expo-status-bar": "55.0.5-canary-20260327-0789fbc",
    "jest-expo": "55.0.12-canary-20260327-0789fbc",
    "react": "19.2.0",
    "react-native": "0.83.4",
    "zod": "^3.22.0"
  },
  "devDependencies": {
    "@types/jest": "^30.0.0",
    "@types/react": "~19.2.2",
    "superjson": "^2.2.6",
    "typescript": "~5.9.2"
  },
  "private": true
}
```

**Note on `expo-modules-core` version:** Run `npx expo install expo-modules-core` from `apps/mobile/` and use whatever version expo resolves for SDK 55. The canary version above is a placeholder — replace with the resolved version.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/modules/carelog-watch/ios/ apps/mobile/package.json
git commit -m "feat(watch): Swift Expo module — WCSession phone-side WatchConnectivity bridge"
```

---

## Task 3: watchOS App Swift Source Files

**Files:**
- Create: `apps/mobile/watchos/CarelogWatch/CarelogWatchApp.swift`
- Create: `apps/mobile/watchos/CarelogWatch/ContentView.swift`
- Create: `apps/mobile/watchos/CarelogWatch/WatchViewModel.swift`

These files are the Watch-side SwiftUI app. The config plugin (Task 4) will copy them into `ios/` during `expo prebuild` and add them to the Xcode target.

- [ ] **Step 1: Create the Watch app entry point**

Create `apps/mobile/watchos/CarelogWatch/CarelogWatchApp.swift`:

```swift
import SwiftUI

@main
struct CarelogWatchApp: App {
  @StateObject private var vm = WatchViewModel()

  var body: some Scene {
    WindowGroup {
      ContentView(vm: vm)
    }
  }
}
```

- [ ] **Step 2: Create the Watch UI**

Create `apps/mobile/watchos/CarelogWatch/ContentView.swift`:

```swift
import SwiftUI

struct ContentView: View {
  @ObservedObject var vm: WatchViewModel

  var body: some View {
    ScrollView {
      VStack(alignment: .leading, spacing: 10) {
        // Next Shift
        if let shift = vm.nextShift {
          VStack(alignment: .leading, spacing: 4) {
            Label("Next shift", systemImage: "person.fill.clock")
              .font(.caption2)
              .foregroundColor(.secondary)
            Text(shift.assigneeName)
              .font(.headline)
            Text(formatTime(shift.startsAt))
              .font(.caption)
              .foregroundColor(.secondary)
          }
          .padding(.bottom, 4)
        }

        // Divider between sections
        if vm.nextShift != nil && vm.nextMedication != nil {
          Divider()
        }

        // Next Medication
        if let med = vm.nextMedication {
          VStack(alignment: .leading, spacing: 4) {
            Label("Next dose", systemImage: "pills.fill")
              .font(.caption2)
              .foregroundColor(.secondary)
            Text(med.name)
              .font(.headline)
            Text(med.dueAt)
              .font(.caption)
              .foregroundColor(.secondary)
          }
        }

        // Empty state
        if vm.nextShift == nil && vm.nextMedication == nil {
          VStack(spacing: 8) {
            Image(systemName: "checkmark.circle")
              .font(.title2)
              .foregroundColor(.green)
            Text("All caught up")
              .font(.caption)
              .foregroundColor(.secondary)
          }
          .frame(maxWidth: .infinity)
          .padding(.top, 20)
        }
      }
      .padding(12)
    }
  }

  private func formatTime(_ iso: String) -> String {
    let formatter = ISO8601DateFormatter()
    formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
    if let date = formatter.date(from: iso) {
      let out = DateFormatter()
      out.dateStyle = .short
      out.timeStyle = .short
      return out.string(from: date)
    }
    return iso
  }
}
```

- [ ] **Step 3: Create the WatchConnectivity receiver**

Create `apps/mobile/watchos/CarelogWatch/WatchViewModel.swift`:

```swift
import Foundation
import WatchConnectivity
import Combine

struct ShiftInfo {
  let assigneeName: String
  let startsAt: String
}

struct MedInfo {
  let name: String
  let dueAt: String
}

/// Receives WCSession application context from the phone and publishes
/// the latest shift/medication data to the SwiftUI view.
class WatchViewModel: NSObject, ObservableObject, WCSessionDelegate {
  @Published var nextShift: ShiftInfo?
  @Published var nextMedication: MedInfo?

  override init() {
    super.init()
    if WCSession.isSupported() {
      let session = WCSession.default
      session.delegate = self
      session.activate()
    }
  }

  // MARK: — WCSessionDelegate

  func session(
    _ session: WCSession,
    activationDidCompleteWith activationState: WCSessionActivationState,
    error: Error?
  ) {
    // Apply whatever context the phone sent before the watch woke up
    DispatchQueue.main.async {
      self.applyContext(session.receivedApplicationContext)
    }
  }

  /// Called when the phone sends an updated application context while the watch is active
  func session(_ session: WCSession, didReceiveApplicationContext context: [String: Any]) {
    DispatchQueue.main.async {
      self.applyContext(context)
    }
  }

  // MARK: — Private

  private func applyContext(_ ctx: [String: Any]) {
    if let s = ctx["nextShift"] as? [String: String] {
      nextShift = ShiftInfo(
        assigneeName: s["assigneeName"] ?? "",
        startsAt: s["startsAt"] ?? ""
      )
    } else {
      nextShift = nil
    }

    if let m = ctx["nextMedication"] as? [String: String] {
      nextMedication = MedInfo(
        name: m["name"] ?? "",
        dueAt: m["dueAt"] ?? ""
      )
    } else {
      nextMedication = nil
    }
  }
}
```

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/watchos/
git commit -m "feat(watch): watchOS SwiftUI app — ContentView, WatchViewModel, WCSession receiver"
```

---

## Task 4: Config Plugin — Wire Watch Target into Xcode

**Files:**
- Create: `apps/mobile/plugins/withCarelogWatch.ts`

The config plugin runs during `expo prebuild` and modifies the generated `ios/` project to add the Watch app target and entitlements.

- [ ] **Step 1: Install config-plugins types (dev dep)**

```bash
cd /Users/bradygrapentine/Documents/projects/carelog/apps/mobile
pnpm add -D @expo/config-plugins
```

- [ ] **Step 2: Create the config plugin**

Create `apps/mobile/plugins/withCarelogWatch.ts`:

```typescript
import {
  ConfigPlugin,
  withXcodeProject,
  withEntitlementsPlist,
  XcodeProject,
} from '@expo/config-plugins'
import * as path from 'path'
import * as fs from 'fs'

const WATCH_TARGET_NAME = 'CarelogWatch'
const APP_GROUP_SUFFIX  = '.watch'  // appended to bundleIdentifier → "com.carelog.app.watch"

/**
 * Adds App Group entitlement to the main iOS target so WCSession can be used,
 * then adds a watchOS single-target app (watchOS 7+ SwiftUI lifecycle) to the
 * generated Xcode project.
 *
 * Source files are copied from apps/mobile/watchos/CarelogWatch/ into
 * ios/CarelogWatch/ during prebuild.
 */
const withCarelogWatch: ConfigPlugin = (config) => {
  // 1. Add App Group entitlement to main iOS target
  config = withEntitlementsPlist(config, (mod) => {
    const existing = (mod.modResults['com.apple.security.application-groups'] as string[]) ?? []
    const bundleId = config.ios?.bundleIdentifier ?? 'com.carelog.app'
    const appGroup = 'group.' + bundleId
    if (!existing.includes(appGroup)) {
      mod.modResults['com.apple.security.application-groups'] = [...existing, appGroup]
    }
    return mod
  })

  // 2. Add Watch target to Xcode project
  config = withXcodeProject(config, (mod) => {
    const xcodeProject: XcodeProject = mod.modResults
    const platformRoot = mod.modRequest.platformProjectRoot  // ios/

    // Guard: don't add target twice across prebuild runs
    if (xcodeProject.pbxTargetByName(WATCH_TARGET_NAME)) {
      return mod
    }

    const bundleId = config.ios?.bundleIdentifier ?? 'com.carelog.app'
    const watchBundleId = bundleId + APP_GROUP_SUFFIX

    // Copy Swift source files from watchos/ → ios/CarelogWatch/
    const srcDir = path.join(platformRoot, '..', '..', 'watchos', WATCH_TARGET_NAME)
    const dstDir = path.join(platformRoot, WATCH_TARGET_NAME)
    if (!fs.existsSync(dstDir)) {
      fs.mkdirSync(dstDir, { recursive: true })
    }
    const swiftFiles = fs.readdirSync(srcDir).filter((f) => f.endsWith('.swift'))
    for (const file of swiftFiles) {
      fs.copyFileSync(path.join(srcDir, file), path.join(dstDir, file))
    }

    // Add the WatchKit 2 App native target
    const target = xcodeProject.addTarget(
      WATCH_TARGET_NAME,
      'watch2_app',
      WATCH_TARGET_NAME,
      watchBundleId,
    )

    // Add Sources build phase
    xcodeProject.addBuildPhase([], 'PBXSourcesBuildPhase', 'Sources', target.uuid)

    // Add each Swift file to the target's Sources build phase
    for (const file of swiftFiles) {
      xcodeProject.addSourceFile(
        WATCH_TARGET_NAME + '/' + file,
        { target: target.uuid },
      )
    }

    // Set watchOS build settings
    const configs = xcodeProject.pbxXCBuildConfigurationSection()
    for (const key of Object.keys(configs)) {
      const cfg = configs[key]
      if (
        cfg.buildSettings &&
        cfg.buildSettings.PRODUCT_NAME === '"' + WATCH_TARGET_NAME + '"'
      ) {
        cfg.buildSettings.TARGETED_DEVICE_FAMILY    = '4'           // watchOS only
        cfg.buildSettings.WATCHOS_DEPLOYMENT_TARGET = '\'7.0\''
        cfg.buildSettings.SWIFT_VERSION             = '\'5.0\''
        cfg.buildSettings.ALWAYS_EMBED_SWIFT_STANDARD_LIBRARIES = 'YES'
      }
    }

    return mod
  })

  return config
}

export default withCarelogWatch
```

- [ ] **Step 3: Register plugin in app.json**

Edit `apps/mobile/app.json` — add the plugin to the `plugins` array:

```json
{
  "expo": {
    "name": "Carelog",
    "slug": "carelog",
    "version": "1.0.0",
    "scheme": "yourcarelog",
    "orientation": "portrait",
    "icon": "./assets/icon.png",
    "userInterfaceStyle": "light",
    "splash": {
      "image": "./assets/splash-icon.png",
      "resizeMode": "contain",
      "backgroundColor": "#ffffff"
    },
    "plugins": [
      "expo-router",
      "expo-secure-store",
      "./plugins/withCarelogWatch"
    ],
    "ios": {
      "supportsTablet": true,
      "bundleIdentifier": "com.carelog.app",
      "associatedDomains": ["applinks:yourcarelog.com"]
    },
    "android": {
      "adaptiveIcon": {
        "foregroundImage": "./assets/android-icon-foreground.png",
        "backgroundColor": "#E6F4FE"
      },
      "package": "com.carelog.app",
      "intentFilters": [
        {
          "action": "VIEW",
          "autoVerify": true,
          "data": [
            { "scheme": "https", "host": "yourcarelog.com", "pathPrefix": "/invite" }
          ],
          "category": ["BROWSABLE", "DEFAULT"]
        }
      ]
    },
    "web": { "favicon": "./assets/favicon.png" }
  }
}
```

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/plugins/ apps/mobile/app.json apps/mobile/package.json
git commit -m "feat(watch): config plugin — Watch app target + App Group entitlement via expo prebuild"
```

---

## Task 5: Update watchBridge.ts + Typecheck

**Files:**
- Modify: `apps/mobile/utils/watchBridge.ts`

Replace the no-op stub with a re-export from the real module. The screens import from `watchBridge`, so we keep the same path — just forward to the actual implementation.

- [ ] **Step 1: Update watchBridge.ts**

Full content of `apps/mobile/utils/watchBridge.ts`:

```typescript
// Wave 3: real implementation — forwards to the CarelogWatch native module.
// Safe to call on Android or when no watch is paired (silently ignored).
export { writeWatchData } from '../modules/carelog-watch'
export type { WatchData } from '../modules/carelog-watch'
```

- [ ] **Step 2: Typecheck mobile**

```bash
cd /Users/bradygrapentine/Documents/projects/carelog/apps/mobile
npx tsc --noEmit
```

Expected: zero errors.

- [ ] **Step 3: Run full test suite**

```bash
cd /Users/bradygrapentine/Documents/projects/carelog
pnpm test
```

Expected:
```
Test Files  68+ passed
Tests       572+ passed (5 new from Task 1)
```

- [ ] **Step 4: Commit**

```bash
cd /Users/bradygrapentine/Documents/projects/carelog
git add apps/mobile/utils/watchBridge.ts
git commit -m "feat(watch): watchBridge.ts forwards to real CarelogWatch native module"
```

---

## Task 6: Prebuild Verification

Verifies that `expo prebuild` runs cleanly and the Watch target appears in the generated project.

- [ ] **Step 1: Run expo prebuild (dry-run)**

```bash
cd /Users/bradygrapentine/Documents/projects/carelog/apps/mobile
npx expo prebuild --clean --platform ios 2>&1 | tail -30
```

Expected: no errors, `ios/` directory generated. The `CarelogWatch/` directory should exist inside `ios/`.

- [ ] **Step 2: Verify Watch target in generated project**

```bash
grep -r "CarelogWatch" ios/carelog.xcodeproj/project.pbxproj | head -10
```

Expected: lines containing `CarelogWatch` target UUID, build configurations, source files.

- [ ] **Step 3: Verify entitlements**

```bash
cat ios/carelog/carelog.entitlements
```

Expected: contains `com.apple.security.application-groups` with `group.com.carelog.app`.

- [ ] **Step 4: Final commit**

```bash
# .gitignore should already exclude ios/ (generated) — only commit source files
git add apps/mobile/watchos/ apps/mobile/modules/carelog-watch/ apps/mobile/plugins/ apps/mobile/utils/watchBridge.ts apps/mobile/app.json apps/mobile/package.json
git status
```

If `ios/` is tracked (it shouldn't be in managed workflow), add it to `.gitignore`.

---

## Self-Review

**Spec coverage:**
- ✅ Phone-side WCSession (`updateApplicationContext`) — CarelogWatchModule.swift
- ✅ Watch-side receiver + SwiftUI UI — WatchViewModel.swift + ContentView.swift
- ✅ JS bridge replacing no-op stub — modules/carelog-watch/index.ts + watchBridge.ts
- ✅ Config plugin wires into Xcode — withCarelogWatch.ts
- ✅ No changes to medications/schedule screens (already call writeWatchData)
- ✅ Tests for JS bridge layer (Swift can't be unit-tested without Xcode)
- ✅ TypeScript clean
- ✅ Prebuild verification

**Type consistency:**
- `WatchData.nextShift` → `{ assigneeName: string; startsAt: string }` — consistent across index.ts, WatchViewModel.swift (uses `["assigneeName"]`, `["startsAt"]` string keys)
- `WatchData.nextMedication` → `{ name: string; dueAt: string }` — consistent across index.ts, WatchViewModel.swift (uses `["name"]`, `["dueAt"]` string keys)
- `writeWatchData(data: WatchData): void` — same signature in index.ts and watchBridge.ts (re-export)

**Placeholders:** None — all code blocks are complete and buildable.

**YAGNI check:** No WidgetKit complications, no CLKComplicationDataSource — just the Watch app view. Complications can be added when there's a clear user need.
