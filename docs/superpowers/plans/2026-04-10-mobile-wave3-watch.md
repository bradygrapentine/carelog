# Mobile Wave 3 — Apple Watch Complications Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Wave 1 `watchBridge` no-op stub with a real native Expo Module that writes `WatchData` to a shared App Group. Add a `CarelogWatch` WidgetKit extension with two SwiftUI complications: `ShiftComplication` (next shift) and `MedComplication` (next medication).

**Architecture:** Custom Expo Module (`watchBridge`) exposes `writeWatchData()` to JS. It writes JSON to the `group.com.carelog` App Group via `UserDefaults`. The `CarelogWatch` watchOS extension is a WidgetKit bundle that reads the same App Group and renders two complications. `expo prebuild` generates the native Xcode project; the watch extension is added as a separate Xcode target.

**Tech Stack:** Expo Modules API · Swift 5.9 · WidgetKit · SwiftUI · App Group entitlements · XCTest

**Prerequisites:** Wave 1 + Wave 2 complete. EAS project ID set. Apple Developer account with watchOS capability. This is iOS-only — no Android watch support.

**IMPORTANT — native development:** This wave requires `expo prebuild` to regenerate native projects. Run `npx expo prebuild --clean` before starting, and work in the generated Xcode project at `apps/mobile/ios/`. Do NOT edit any file under `apps/mobile/ios/` directly — always edit source files and re-run prebuild. The one exception is the `CarelogWatch` target itself, which is added once and lives outside the auto-generated area.

---

## File Map

```
apps/mobile/
  modules/watch-bridge/
    index.ts                              CREATE — JS entry point exports WatchData type + writeWatchData()
    src/
      WatchBridgeModule.ts               CREATE — Expo Module declaration (TypeScript)
      WatchBridgeModule.swift            CREATE — native implementation (writes to App Group UserDefaults)
  ios/
    CarelogWatch/                        CREATE — watchOS extension (Xcode target, added manually)
      CarelogWatchBundle.swift           CREATE — main entry point (@main WidgetBundle)
      ShiftComplication.swift            CREATE — shift complication (accessoryRectangular)
      MedComplication.swift              CREATE — med complication (accessoryCircular)
      WatchDataLoader.swift              CREATE — reads WatchData JSON from App Group
      Info.plist                         CREATE — watchOS extension Info.plist
    CarelogWatchTests/
      WatchDataContractTests.swift       CREATE — XCTest: verifies JSON decoding of WatchData shape
    Carelog.entitlements                 MODIFY — add App Group entitlement
    CarelogWatch.entitlements            CREATE — watch extension entitlements (same App Group)
  app/(app)/medications/
    index.tsx                            MODIFY — call writeWatchData() after successful fetch
  app/(app)/schedule/
    index.tsx                            MODIFY — call writeWatchData() after successful fetch
  __tests__/
    watchBridge.test.ts                  MODIFY — update stub tests to verify real module shape
```

---

## Task 1: Replace watchBridge Stub with Real Expo Module

**Files:**
- Create: `apps/mobile/modules/watch-bridge/index.ts`
- Create: `apps/mobile/modules/watch-bridge/src/WatchBridgeModule.ts`
- Create: `apps/mobile/modules/watch-bridge/src/WatchBridgeModule.swift`
- Delete: `apps/mobile/utils/watchBridge.ts` (the stub)

- [ ] **Step 1: Verify the stub exists**

```bash
cat apps/mobile/utils/watchBridge.ts
```

Expected: no-op stub with `WatchData` type and `writeWatchData(_data)` that returns `void`.

- [ ] **Step 2: Create the Expo Module TypeScript declaration**

```typescript
// apps/mobile/modules/watch-bridge/src/WatchBridgeModule.ts
import { requireNativeModule } from 'expo-modules-core'

export type WatchData = {
  nextShift: { assigneeName: string; startsAt: string } | null
  nextMedication: { name: string; dueAt: string } | null
  updatedAt: string
}

export default requireNativeModule('WatchBridge')
```

- [ ] **Step 3: Create the JS entry point**

```typescript
// apps/mobile/modules/watch-bridge/index.ts
import WatchBridgeModule, { type WatchData } from './src/WatchBridgeModule'
import { Platform } from 'react-native'

export type { WatchData }

/**
 * Write care data to the App Group so the CarelogWatch complication can display it.
 * No-ops on Android (no Watch support) and when the native module is unavailable.
 */
export function writeWatchData(data: WatchData): void {
  if (Platform.OS !== 'ios') return
  try {
    WatchBridgeModule.writeWatchData(JSON.stringify(data))
  } catch {
    // Module not available (simulator without watch, Android)
  }
}
```

- [ ] **Step 4: Write the native Swift module**

```swift
// apps/mobile/modules/watch-bridge/src/WatchBridgeModule.swift
import ExpoModulesCore
import Foundation

public class WatchBridgeModule: Module {
  private let appGroupId = "group.com.carelog"

  public func definition() -> ModuleDefinition {
    Name("WatchBridge")

    Function("writeWatchData") { (jsonString: String) in
      guard let defaults = UserDefaults(suiteName: self.appGroupId) else {
        return
      }
      defaults.set(jsonString, forKey: "watchData")
      // Post Darwin notification so watch extension can reload timeline
      CFNotificationCenterPostNotification(
        CFNotificationCenterGetDarwinNotifyCenter(),
        CFNotificationName("com.carelog.watchDataUpdated" as CFString),
        nil, nil, true
      )
    }
  }
}
```

- [ ] **Step 5: Update imports in medications/index.tsx + schedule/index.tsx**

Replace:
```typescript
import { writeWatchData } from '@/utils/watchBridge'
```
With:
```typescript
import { writeWatchData } from '@/modules/watch-bridge'
```

- [ ] **Step 6: Delete the stub**

```bash
rm apps/mobile/utils/watchBridge.ts
```

- [ ] **Step 7: Run typecheck**

```bash
cd apps/mobile && npx tsc --noEmit 2>&1 | head -15
```

Expected: no errors (module exports same `WatchData` type and `writeWatchData` function).

- [ ] **Step 8: Commit**

```bash
git add apps/mobile/modules/watch-bridge/ apps/mobile/app/\(app\)/medications/index.tsx apps/mobile/app/\(app\)/schedule/index.tsx
git rm apps/mobile/utils/watchBridge.ts
git commit -m "feat: replace watchBridge stub with real Expo Module"
```

---

## Task 2: expo prebuild + App Group Entitlement

**Files:**
- Modify: `apps/mobile/app.json` — add App Group entitlement plugin
- Modify: `apps/mobile/ios/Carelog.entitlements` — generated by prebuild, then verified

- [ ] **Step 1: Add App Group to app.json**

In `apps/mobile/app.json`, update the `ios` config:

```json
{
  "expo": {
    "ios": {
      "bundleIdentifier": "com.carelog",
      "entitlements": {
        "com.apple.security.application-groups": ["group.com.carelog"]
      }
    }
  }
}
```

- [ ] **Step 2: Run expo prebuild**

```bash
cd apps/mobile
npx expo prebuild --clean --platform ios
```

Expected: generates `ios/` with the native project. Takes 1-2 minutes.

- [ ] **Step 3: Verify entitlements file**

```bash
cat apps/mobile/ios/Carelog/Carelog.entitlements
```

Expected: contains:
```xml
<key>com.apple.security.application-groups</key>
<array>
  <string>group.com.carelog</string>
</array>
```

- [ ] **Step 4: Open Xcode to verify module is linked**

```bash
open apps/mobile/ios/Carelog.xcworkspace
```

In Xcode: Carelog target → Build Phases → Compile Sources — verify `WatchBridgeModule.swift` appears. If not, add it manually via **Add Files to "Carelog"**.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/app.json apps/mobile/ios/
git commit -m "feat: expo prebuild with App Group entitlement for watch bridge"
```

---

## Task 3: CarelogWatch Xcode Target

**Files:**
- Create: `apps/mobile/ios/CarelogWatch/` (all Swift files + Info.plist)
- Create: `apps/mobile/ios/CarelogWatch/CarelogWatch.entitlements`

This task is done inside Xcode, then the created files are committed.

- [ ] **Step 1: Add watchOS Widget Extension target in Xcode**

1. Open `apps/mobile/ios/Carelog.xcworkspace`
2. File → New → Target
3. Select **watchOS** tab → **Widget Extension**
4. Fill in:
   - **Product Name:** `CarelogWatch`
   - **Bundle Identifier:** `com.carelog.watch`
   - **Team:** Your Apple Developer team
   - **Include Configuration Intent:** NO (we use `AppIntentTimelineProvider`)
5. Click **Finish**
6. When prompted "Activate CarelogWatch scheme?" → **Cancel** (keep Carelog as active scheme)

- [ ] **Step 2: Configure App Group for the watch target**

1. In Xcode → select **CarelogWatch** target → **Signing & Capabilities**
2. Click **+** → **App Groups**
3. Add: `group.com.carelog`
4. Xcode generates `CarelogWatch.entitlements` — verify it contains the App Group

- [ ] **Step 3: Create WatchDataLoader.swift**

Create this file inside the `CarelogWatch` group in Xcode (or write directly and add to target):

```swift
// apps/mobile/ios/CarelogWatch/WatchDataLoader.swift
import Foundation
import WidgetKit

struct WatchShift: Codable {
  let assigneeName: String
  let startsAt: String
}

struct WatchMedication: Codable {
  let name: String
  let dueAt: String
}

struct WatchData: Codable {
  let nextShift: WatchShift?
  let nextMedication: WatchMedication?
  let updatedAt: String
}

enum WatchDataLoader {
  private static let appGroupId = "group.com.carelog"
  private static let key = "watchData"

  static func load() -> WatchData? {
    guard
      let defaults = UserDefaults(suiteName: appGroupId),
      let json = defaults.string(forKey: key),
      let data = json.data(using: .utf8)
    else { return nil }

    return try? JSONDecoder().decode(WatchData.self, from: data)
  }
}
```

- [ ] **Step 4: Commit generated Xcode files**

```bash
git add apps/mobile/ios/CarelogWatch/ apps/mobile/ios/Carelog.xcodeproj/
git commit -m "feat: CarelogWatch watchOS Widget Extension target added"
```

---

## Task 4: ShiftComplication SwiftUI Widget

**Files:**
- Create: `apps/mobile/ios/CarelogWatch/ShiftComplication.swift`

- [ ] **Step 1: Write ShiftComplication**

```swift
// apps/mobile/ios/CarelogWatch/ShiftComplication.swift
import WidgetKit
import SwiftUI

struct ShiftEntry: TimelineEntry {
  let date: Date
  let assigneeName: String?
  let startsAt: String?
}

struct ShiftTimelineProvider: TimelineProvider {
  func placeholder(in context: Context) -> ShiftEntry {
    ShiftEntry(date: Date(), assigneeName: "Brady", startsAt: "2:00 PM")
  }

  func getSnapshot(in context: Context, completion: @escaping (ShiftEntry) -> Void) {
    let entry = makeEntry()
    completion(entry)
  }

  func getTimeline(in context: Context, completion: @escaping (Timeline<ShiftEntry>) -> Void) {
    let entry = makeEntry()
    // Refresh every 15 minutes (phone will push updates via Darwin notification)
    let next = Calendar.current.date(byAdding: .minute, value: 15, to: Date()) ?? Date()
    completion(Timeline(entries: [entry], policy: .after(next)))
  }

  private func makeEntry() -> ShiftEntry {
    let data = WatchDataLoader.load()
    return ShiftEntry(
      date: Date(),
      assigneeName: data?.nextShift?.assigneeName,
      startsAt: data?.nextShift.map { formatTime($0.startsAt) }
    )
  }

  private func formatTime(_ iso: String) -> String {
    let formatter = ISO8601DateFormatter()
    formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
    guard let date = formatter.date(from: iso) else { return iso }
    let display = DateFormatter()
    display.dateFormat = "h:mm a"
    return display.string(from: date)
  }
}

struct ShiftComplicationView: View {
  let entry: ShiftEntry

  var body: some View {
    VStack(alignment: .leading, spacing: 2) {
      if let name = entry.assigneeName, let time = entry.startsAt {
        Text(name)
          .font(.headline)
          .minimumScaleFactor(0.7)
        Text(time)
          .font(.subheadline)
          .foregroundStyle(.secondary)
      } else {
        Text("No shifts today")
          .font(.caption)
          .foregroundStyle(.secondary)
      }
    }
  }
}

struct ShiftComplication: Widget {
  let kind = "ShiftComplication"

  var body: some WidgetConfiguration {
    StaticConfiguration(kind: kind, provider: ShiftTimelineProvider()) { entry in
      ShiftComplicationView(entry: entry)
        .containerBackground(.fill.tertiary, for: .widget)
    }
    .configurationDisplayName("Next Shift")
    .description("Shows the next upcoming care shift.")
    .supportedFamilies([.accessoryRectangular])
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/mobile/ios/CarelogWatch/ShiftComplication.swift
git commit -m "feat: ShiftComplication accessoryRectangular watch widget"
```

---

## Task 5: MedComplication SwiftUI Widget

**Files:**
- Create: `apps/mobile/ios/CarelogWatch/MedComplication.swift`

- [ ] **Step 1: Write MedComplication**

```swift
// apps/mobile/ios/CarelogWatch/MedComplication.swift
import WidgetKit
import SwiftUI

struct MedEntry: TimelineEntry {
  let date: Date
  let medName: String?
  let dueAt: String?
}

struct MedTimelineProvider: TimelineProvider {
  func placeholder(in context: Context) -> MedEntry {
    MedEntry(date: Date(), medName: "Lisinopril", dueAt: "8:00 PM")
  }

  func getSnapshot(in context: Context, completion: @escaping (MedEntry) -> Void) {
    completion(makeEntry())
  }

  func getTimeline(in context: Context, completion: @escaping (Timeline<MedEntry>) -> Void) {
    let entry = makeEntry()
    let next = Calendar.current.date(byAdding: .minute, value: 15, to: Date()) ?? Date()
    completion(Timeline(entries: [entry], policy: .after(next)))
  }

  private func makeEntry() -> MedEntry {
    let data = WatchDataLoader.load()
    return MedEntry(
      date: Date(),
      medName: data?.nextMedication?.name,
      dueAt: data?.nextMedication.map { formatTime($0.dueAt) }
    )
  }

  private func formatTime(_ iso: String) -> String {
    let formatter = ISO8601DateFormatter()
    formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
    guard let date = formatter.date(from: iso) else { return iso }
    let display = DateFormatter()
    display.dateFormat = "h:mm a"
    return display.string(from: date)
  }
}

struct MedComplicationView: View {
  let entry: MedEntry

  var body: some View {
    VStack(spacing: 2) {
      if let name = entry.medName, let time = entry.dueAt {
        Text(name)
          .font(.caption2)
          .minimumScaleFactor(0.6)
          .multilineTextAlignment(.center)
        Text(time)
          .font(.caption2)
          .foregroundStyle(.secondary)
      } else {
        Image(systemName: "pills.fill")
          .font(.title3)
        Text("All given")
          .font(.caption2)
          .foregroundStyle(.secondary)
      }
    }
  }
}

struct MedComplication: Widget {
  let kind = "MedComplication"

  var body: some WidgetConfiguration {
    StaticConfiguration(kind: kind, provider: MedTimelineProvider()) { entry in
      MedComplicationView(entry: entry)
        .containerBackground(.fill.tertiary, for: .widget)
    }
    .configurationDisplayName("Next Medication")
    .description("Shows the next medication due time.")
    .supportedFamilies([.accessoryCircular])
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/mobile/ios/CarelogWatch/MedComplication.swift
git commit -m "feat: MedComplication accessoryCircular watch widget"
```

---

## Task 6: Widget Bundle Entry Point

**Files:**
- Create: `apps/mobile/ios/CarelogWatch/CarelogWatchBundle.swift`

- [ ] **Step 1: Write the widget bundle**

```swift
// apps/mobile/ios/CarelogWatch/CarelogWatchBundle.swift
import WidgetKit
import SwiftUI

@main
struct CarelogWatchBundle: WidgetBundle {
  var body: some Widget {
    ShiftComplication()
    MedComplication()
  }
}
```

- [ ] **Step 2: Verify no other @main exists in CarelogWatch**

```bash
grep -r "@main" apps/mobile/ios/CarelogWatch/
```

Expected: only `CarelogWatchBundle.swift` has `@main`.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/ios/CarelogWatch/CarelogWatchBundle.swift
git commit -m "feat: CarelogWatchBundle @main entry point for both complications"
```

---

## Task 7: XCTest — WatchData Contract Tests

**Files:**
- Create: `apps/mobile/ios/CarelogWatchTests/WatchDataContractTests.swift`

- [ ] **Step 1: Add test target in Xcode**

1. File → New → Target → **watchOS** → **Unit Testing Bundle**
2. Name: `CarelogWatchTests`
3. Target to test: `CarelogWatch`

- [ ] **Step 2: Write the contract test**

```swift
// apps/mobile/ios/CarelogWatchTests/WatchDataContractTests.swift
import XCTest
@testable import CarelogWatch

final class WatchDataContractTests: XCTestCase {

  func testFullWatchDataDecodes() throws {
    let json = """
    {
      "nextShift": { "assigneeName": "Brady", "startsAt": "2026-04-10T14:00:00Z" },
      "nextMedication": { "name": "Lisinopril", "dueAt": "2026-04-10T20:00:00Z" },
      "updatedAt": "2026-04-10T13:00:00Z"
    }
    """.data(using: .utf8)!

    let decoded = try JSONDecoder().decode(WatchData.self, from: json)

    XCTAssertEqual(decoded.nextShift?.assigneeName, "Brady")
    XCTAssertEqual(decoded.nextShift?.startsAt, "2026-04-10T14:00:00Z")
    XCTAssertEqual(decoded.nextMedication?.name, "Lisinopril")
    XCTAssertEqual(decoded.nextMedication?.dueAt, "2026-04-10T20:00:00Z")
  }

  func testNullFieldsDecodeCorrectly() throws {
    let json = """
    {
      "nextShift": null,
      "nextMedication": null,
      "updatedAt": "2026-04-10T13:00:00Z"
    }
    """.data(using: .utf8)!

    let decoded = try JSONDecoder().decode(WatchData.self, from: json)

    XCTAssertNil(decoded.nextShift)
    XCTAssertNil(decoded.nextMedication)
  }

  func testMissingFieldsFailGracefully() {
    let json = """{ "updatedAt": "2026-04-10T13:00:00Z" }""".data(using: .utf8)!
    // nextShift and nextMedication are optional — should decode without error
    XCTAssertNoThrow(try JSONDecoder().decode(WatchData.self, from: json))
  }
}
```

- [ ] **Step 3: Run XCTest**

In Xcode: Product → Test (⌘U) with `CarelogWatchTests` scheme selected.

Or via command line:
```bash
xcodebuild test \
  -workspace apps/mobile/ios/Carelog.xcworkspace \
  -scheme CarelogWatchTests \
  -destination 'platform=watchOS Simulator,name=Apple Watch Series 9 (45mm)' \
  2>&1 | grep -E "PASS|FAIL|error:"
```

Expected: 3 tests pass.

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/ios/CarelogWatchTests/
git commit -m "test: XCTest WatchData JSON contract tests"
```

---

## Task 8: Darwin Notification Observer (Timeline Reload)

**Files:**
- Modify: `apps/mobile/ios/CarelogWatch/WatchDataLoader.swift`

When the phone writes new data, WidgetKit timelines need to reload. The cleanest mechanism is a Darwin notification.

- [ ] **Step 1: Add observer registration**

Add a static method to `WatchDataLoader` that registers for the Darwin notification and calls `WidgetCenter.shared.reloadAllTimelines()`:

```swift
// Add to WatchDataLoader.swift
import WidgetKit

extension WatchDataLoader {
  /// Call this from each widget's `getTimeline` to register for phone-push updates.
  static func registerForUpdates() {
    CFNotificationCenterAddObserver(
      CFNotificationCenterGetDarwinNotifyCenter(),
      nil,
      { _, _, _, _, _ in
        WidgetCenter.shared.reloadAllTimelines()
      },
      "com.carelog.watchDataUpdated" as CFString,
      nil,
      .deliverImmediately
    )
  }
}
```

- [ ] **Step 2: Call registerForUpdates in each provider's init**

In `ShiftTimelineProvider` and `MedTimelineProvider`, add:

```swift
init() {
  WatchDataLoader.registerForUpdates()
}
```

- [ ] **Step 3: Run typecheck (Xcode build)**

```bash
xcodebuild build \
  -workspace apps/mobile/ios/Carelog.xcworkspace \
  -scheme CarelogWatch \
  -destination 'generic/platform=watchOS' \
  2>&1 | grep -E "BUILD|error:"
```

Expected: `BUILD SUCCEEDED`.

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/ios/CarelogWatch/WatchDataLoader.swift apps/mobile/ios/CarelogWatch/ShiftComplication.swift apps/mobile/ios/CarelogWatch/MedComplication.swift
git commit -m "feat: Darwin notification observer for automatic complication timeline reload"
```

---

## Task 9: EAS Build Configuration

**Files:**
- Modify: `apps/mobile/eas.json`

- [ ] **Step 1: Update eas.json to include watch extension**

Read current `apps/mobile/eas.json`. The watch extension is included automatically because it's an Xcode target in the same workspace. Verify the `production` profile has:

```json
{
  "build": {
    "production": {
      "ios": {
        "buildConfiguration": "Release",
        "credentialsSource": "remote"
      },
      "android": {
        "buildType": "apk",
        "googleServicesFile": "./google-services.json"
      }
    }
  }
}
```

- [ ] **Step 2: Add watchOS deployment target to Xcode**

In Xcode → `CarelogWatch` target → **Build Settings** → **Deployment Target**:
- watchOS Deployment Target: `10.0` (matches WidgetKit accessory family availability)

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/eas.json
git commit -m "chore: verify EAS build config includes watch extension"
```

---

## Verification

### Unit tests
```bash
cd apps/mobile && npx jest --verbose 2>&1 | tail -10
```

### Xcode build + tests
```bash
xcodebuild test \
  -workspace apps/mobile/ios/Carelog.xcworkspace \
  -scheme CarelogWatchTests \
  -destination 'platform=watchOS Simulator,name=Apple Watch Series 9 (45mm)' \
  2>&1 | grep -E "PASS|FAIL|error:|BUILD"
```

### End-to-end simulator test
1. Run simulator: iPhone 15 paired with Apple Watch Series 9
2. Build and run: `npx expo run:ios`
3. Open the Watch app → add `CarelogWatch` complication to a watch face
4. In the iOS app → load Journal or Medications screen
5. Verify complication updates within 15 minutes (or force timeline reload in Simulator → Debug → Force complication update)

### EAS build (optional — requires credentials)
```bash
cd apps/mobile
eas build --platform ios --profile development
```
