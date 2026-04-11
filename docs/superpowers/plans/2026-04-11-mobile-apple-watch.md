# Apple Watch Companion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build Apple Watch companion with medication quick-log, mood pulse, two complications (next med + shift status), and alert escalation via APNs mirroring.

**Architecture:** SwiftUI watch app communicates with iOS app via WCSession. Watch sends quick-log actions back to phone via `sendMessage`. Phone enqueues them into the shared offline queue. Complications use `CLKComplicationDataSource` fed by `transferUserInfo` data. Alert escalation is free via APNs mirroring (no custom code needed).

**Tech Stack:** SwiftUI, WatchConnectivity, ClockKit, Expo Modules (native bridge)

**Spec:** `docs/superpowers/specs/2026-04-11-mobile-offline-testing-watch-design.md`

**Prerequisites:**
- Complete `2026-04-11-mobile-offline-first.md` (watch quick-log enqueues to the shared offline queue)
- Xcode installed with watchOS simulator

**Note:** All Swift files live in `apps/mobile/watchos/CarelogWatch/` and are hand-maintained. The config plugin (`plugins/withCarelogWatch.ts`) copies them to `ios/CarelogWatch/` during `expo prebuild`. Never edit files in `ios/` directly.

---

### Task 1: Add medication quick-log to WatchViewModel

**Files:**
- Modify: `apps/mobile/watchos/CarelogWatch/WatchViewModel.swift`

- [ ] **Step 1: Add medications list and sendMessage support to WatchViewModel**

Update `apps/mobile/watchos/CarelogWatch/WatchViewModel.swift`:

```swift
import Foundation
import WatchConnectivity
import Combine

struct ShiftInfo {
  let assigneeName: String
  let startsAt: String
}

struct MedInfo: Identifiable {
  let id: String        // medication_id
  let name: String
  let dosage: String
  let dueAt: String
  let scheduledTime: String
}

/// Receives WCSession application context from the phone and publishes
/// the latest shift/medication data to the SwiftUI views.
/// Sends quick-log actions back to the phone via sendMessage.
class WatchViewModel: NSObject, ObservableObject, WCSessionDelegate {
  @Published var nextShift: ShiftInfo?
  @Published var nextMedication: MedInfo?
  @Published var medications: [MedInfo] = []
  @Published var lastLogConfirmation: String?

  private var session: WCSession?

  override init() {
    super.init()
    if WCSession.isSupported() {
      let s = WCSession.default
      s.delegate = self
      s.activate()
      self.session = s
    }
  }

  // MARK: — Quick-Log Actions

  /// Send a medication log action back to the phone for offline queue insertion
  func logMedication(_ med: MedInfo, action: String = "given") {
    let message: [String: Any] = [
      "type": "medication_log",
      "payload": [
        "medication_id": med.id,
        "scheduled_time": med.scheduledTime,
        "action": action,
      ]
    ]
    session?.sendMessage(message, replyHandler: { [weak self] reply in
      DispatchQueue.main.async {
        self?.lastLogConfirmation = med.name
        // Auto-clear after 2 seconds
        DispatchQueue.main.asyncAfter(deadline: .now() + 2) {
          self?.lastLogConfirmation = nil
        }
      }
    }, errorHandler: { error in
      print("WCSession sendMessage error: \(error.localizedDescription)")
    })
  }

  /// Send a mood pulse back to the phone for offline queue insertion
  func logMood(_ mood: String) {
    let message: [String: Any] = [
      "type": "journal_entry",
      "payload": [
        "mood": mood,
        "text": "Mood check-in from Apple Watch",
      ]
    ]
    session?.sendMessage(message, replyHandler: { [weak self] _ in
      DispatchQueue.main.async {
        self?.lastLogConfirmation = mood
        DispatchQueue.main.asyncAfter(deadline: .now() + 2) {
          self?.lastLogConfirmation = nil
        }
      }
    }, errorHandler: { error in
      print("WCSession sendMessage error: \(error.localizedDescription)")
    })
  }

  // MARK: — WCSessionDelegate

  func session(
    _ session: WCSession,
    activationDidCompleteWith activationState: WCSessionActivationState,
    error: Error?
  ) {
    DispatchQueue.main.async {
      self.applyContext(session.receivedApplicationContext)
    }
  }

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
        id: m["id"] ?? "",
        name: m["name"] ?? "",
        dosage: m["dosage"] ?? "",
        dueAt: m["dueAt"] ?? "",
        scheduledTime: m["scheduledTime"] ?? ""
      )
    } else {
      nextMedication = nil
    }

    // Parse medications list for quick-log
    if let medsArray = ctx["medications"] as? [[String: String]] {
      medications = medsArray.compactMap { m in
        guard let id = m["id"], let name = m["name"] else { return nil }
        return MedInfo(
          id: id,
          name: name,
          dosage: m["dosage"] ?? "",
          dueAt: m["dueAt"] ?? "",
          scheduledTime: m["scheduledTime"] ?? ""
        )
      }
    }
  }
}
```

- [ ] **Step 2: Verify it compiles**

Run: `cd apps/mobile && npx expo prebuild --clean --platform ios 2>&1 | tail -5`
Then: Open `ios/Carelog.xcworkspace` in Xcode and build the CarelogWatch target.

Note: This is a manual verification step — Swift compilation requires Xcode. If you don't have Xcode available, skip to the next task and verify later.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/watchos/CarelogWatch/WatchViewModel.swift
git commit -m "feat(watch): add medication and mood quick-log to WatchViewModel"
```

---

### Task 2: Build medication confirmation view

**Files:**
- Create: `apps/mobile/watchos/CarelogWatch/MedConfirmView.swift`

- [ ] **Step 1: Create MedConfirmView**

Create `apps/mobile/watchos/CarelogWatch/MedConfirmView.swift`:

```swift
import SwiftUI

struct MedConfirmView: View {
  @ObservedObject var vm: WatchViewModel
  let med: MedInfo
  @Environment(\.dismiss) private var dismiss

  var body: some View {
    VStack(spacing: 16) {
      Image(systemName: "pills.fill")
        .font(.title2)
        .foregroundColor(.blue)

      Text("Log \(med.name)?")
        .font(.headline)
        .multilineTextAlignment(.center)

      Text("\(med.dosage) · \(med.scheduledTime)")
        .font(.caption)
        .foregroundColor(.secondary)

      Button(action: {
        vm.logMedication(med)
        dismiss()
      }) {
        Label("Mark Given", systemImage: "checkmark.circle.fill")
      }
      .buttonStyle(.borderedProminent)
      .tint(.green)

      Button("Cancel", role: .cancel) {
        dismiss()
      }
      .font(.caption)
    }
    .padding()
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/mobile/watchos/CarelogWatch/MedConfirmView.swift
git commit -m "feat(watch): add medication confirmation view"
```

---

### Task 3: Build mood pulse view

**Files:**
- Create: `apps/mobile/watchos/CarelogWatch/MoodPulseView.swift`

- [ ] **Step 1: Create MoodPulseView**

Create `apps/mobile/watchos/CarelogWatch/MoodPulseView.swift`:

```swift
import SwiftUI

struct MoodPulseView: View {
  @ObservedObject var vm: WatchViewModel
  @Environment(\.dismiss) private var dismiss

  private let moods: [(key: String, emoji: String, label: String)] = [
    ("great", "😊", "Great"),
    ("good", "🙂", "Good"),
    ("okay", "😐", "Okay"),
    ("rough", "😟", "Rough"),
    ("bad", "😢", "Bad"),
  ]

  var body: some View {
    ScrollView {
      VStack(spacing: 8) {
        Text("How are they feeling?")
          .font(.headline)
          .padding(.bottom, 4)

        ForEach(moods, id: \.key) { mood in
          Button(action: {
            vm.logMood(mood.key)
            dismiss()
          }) {
            HStack {
              Text(mood.emoji)
                .font(.title3)
              Text(mood.label)
                .font(.body)
              Spacer()
            }
            .padding(.horizontal, 8)
            .padding(.vertical, 6)
          }
          .buttonStyle(.plain)
        }
      }
      .padding(12)
    }
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/mobile/watchos/CarelogWatch/MoodPulseView.swift
git commit -m "feat(watch): add mood pulse view"
```

---

### Task 4: Update ContentView with navigation to quick-log views

**Files:**
- Modify: `apps/mobile/watchos/CarelogWatch/ContentView.swift`

- [ ] **Step 1: Update ContentView with NavigationStack and quick-log links**

Replace `apps/mobile/watchos/CarelogWatch/ContentView.swift`:

```swift
import SwiftUI

struct ContentView: View {
  @ObservedObject var vm: WatchViewModel

  var body: some View {
    NavigationStack {
      ScrollView {
        VStack(alignment: .leading, spacing: 12) {
          // Confirmation overlay
          if let confirmation = vm.lastLogConfirmation {
            HStack {
              Image(systemName: "checkmark.circle.fill")
                .foregroundColor(.green)
              Text("Logged: \(confirmation)")
                .font(.caption)
            }
            .padding(8)
            .background(Color.green.opacity(0.15))
            .cornerRadius(8)
            .transition(.opacity)
          }

          // Next Shift
          if let shift = vm.nextShift {
            VStack(alignment: .leading, spacing: 4) {
              Label("On shift", systemImage: "person.fill.clock")
                .font(.caption2)
                .foregroundColor(.secondary)
              Text(shift.assigneeName)
                .font(.headline)
              Text(formatTime(shift.startsAt))
                .font(.caption)
                .foregroundColor(.secondary)
            }
          }

          // Medications — tap to quick-log
          if !vm.medications.isEmpty {
            Divider()
            Label("Medications", systemImage: "pills.fill")
              .font(.caption2)
              .foregroundColor(.secondary)

            ForEach(vm.medications) { med in
              NavigationLink(destination: MedConfirmView(vm: vm, med: med)) {
                HStack {
                  VStack(alignment: .leading, spacing: 2) {
                    Text(med.name)
                      .font(.body)
                    Text("\(med.dosage) · \(med.scheduledTime)")
                      .font(.caption2)
                      .foregroundColor(.secondary)
                  }
                  Spacer()
                  Image(systemName: "chevron.right")
                    .font(.caption)
                    .foregroundColor(.secondary)
                }
              }
              .buttonStyle(.plain)
            }
          } else if let med = vm.nextMedication {
            // Fallback: single next-med display (legacy data shape)
            Divider()
            NavigationLink(destination: MedConfirmView(vm: vm, med: med)) {
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
            .buttonStyle(.plain)
          }

          // Mood pulse button
          Divider()
          NavigationLink(destination: MoodPulseView(vm: vm)) {
            Label("Log mood", systemImage: "heart.fill")
              .font(.body)
          }

          // Empty state
          if vm.nextShift == nil && vm.medications.isEmpty && vm.nextMedication == nil {
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
      .navigationTitle("Carelog")
      .navigationBarTitleDisplayMode(.inline)
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

- [ ] **Step 2: Commit**

```bash
git add apps/mobile/watchos/CarelogWatch/ContentView.swift
git commit -m "feat(watch): update ContentView with quick-log navigation and mood pulse"
```

---

### Task 5: Build complication provider

**Files:**
- Create: `apps/mobile/watchos/CarelogWatch/ComplicationProvider.swift`

- [ ] **Step 1: Create ComplicationProvider**

Create `apps/mobile/watchos/CarelogWatch/ComplicationProvider.swift`:

```swift
import ClockKit
import WatchConnectivity

class ComplicationProvider: NSObject, CLKComplicationDataSource {

  // MARK: — Timeline Configuration

  func getComplicationDescriptors(handler: @escaping ([CLKComplicationDescriptor]) -> Void) {
    let descriptors = [
      CLKComplicationDescriptor(
        identifier: "nextMedication",
        displayName: "Next Medication",
        supportedFamilies: [.graphicRectangular]
      ),
      CLKComplicationDescriptor(
        identifier: "shiftStatus",
        displayName: "Shift Status",
        supportedFamilies: [.graphicCircular]
      ),
    ]
    handler(descriptors)
  }

  func getCurrentTimelineEntry(
    for complication: CLKComplication,
    withHandler handler: @escaping (CLKComplicationTimelineEntry?) -> Void
  ) {
    let ctx = WCSession.default.receivedApplicationContext

    switch complication.identifier {
    case "nextMedication":
      if let med = ctx["nextMedication"] as? [String: String],
         let name = med["name"],
         let dueAt = med["dueAt"] {
        let dosage = med["dosage"] ?? ""
        let template = CLKComplicationTemplateGraphicRectangularStandardBody(
          headerTextProvider: CLKTextProvider(format: "💊 %@", name),
          body1TextProvider: CLKTextProvider(format: "%@ · %@", dosage, dueAt)
        )
        handler(CLKComplicationTimelineEntry(date: Date(), complicationTemplate: template))
      } else {
        let template = CLKComplicationTemplateGraphicRectangularStandardBody(
          headerTextProvider: CLKTextProvider(format: "No medications"),
          body1TextProvider: CLKTextProvider(format: "All caught up")
        )
        handler(CLKComplicationTimelineEntry(date: Date(), complicationTemplate: template))
      }

    case "shiftStatus":
      if let shift = ctx["nextShift"] as? [String: String],
         let assignee = shift["assigneeName"],
         let startsAt = shift["startsAt"] {
        let initial = String(assignee.prefix(1))
        let template = CLKComplicationTemplateGraphicCircularStackText(
          line1TextProvider: CLKTextProvider(format: initial),
          line2TextProvider: CLKTextProvider(format: formatShortTime(startsAt))
        )
        handler(CLKComplicationTimelineEntry(date: Date(), complicationTemplate: template))
      } else {
        let template = CLKComplicationTemplateGraphicCircularStackText(
          line1TextProvider: CLKTextProvider(format: "—"),
          line2TextProvider: CLKTextProvider(format: "Off")
        )
        handler(CLKComplicationTimelineEntry(date: Date(), complicationTemplate: template))
      }

    default:
      handler(nil)
    }
  }

  func getTimelineEndDate(
    for complication: CLKComplication,
    withHandler handler: @escaping (Date?) -> Void
  ) {
    // Timeline entries are refreshed when phone pushes new context
    handler(Date().addingTimeInterval(60 * 60)) // 1 hour ahead
  }

  func getPrivacyBehavior(
    for complication: CLKComplication,
    withHandler handler: @escaping (CLKComplicationPrivacyBehavior) -> Void
  ) {
    handler(.showOnLockScreen)
  }

  // MARK: — Private

  private func formatShortTime(_ iso: String) -> String {
    let formatter = ISO8601DateFormatter()
    formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
    if let date = formatter.date(from: iso) {
      let remaining = date.timeIntervalSince(Date())
      if remaining > 0 {
        let hours = Int(remaining) / 3600
        let minutes = (Int(remaining) % 3600) / 60
        if hours > 0 { return "\(hours)h" }
        return "\(minutes)m"
      }
      return "Now"
    }
    return "—"
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/mobile/watchos/CarelogWatch/ComplicationProvider.swift
git commit -m "feat(watch): add complication provider for next-med and shift-status"
```

---

### Task 6: Handle watch messages on the phone side

**Files:**
- Modify: `apps/mobile/modules/carelog-watch/index.ts`
- Create: `apps/mobile/modules/carelog-watch/ios/CarelogWatchModule.swift` (if not exists)

This task adds a native module method to receive WCSession messages from the watch and forward them to JavaScript.

- [ ] **Step 1: Check existing native module structure**

Run: `ls -la apps/mobile/modules/carelog-watch/`

This step determines whether the Expo module has a Swift implementation file or is JS-only. The existing `writeWatchData` works via `requireNativeModule`, so there should be a Swift file.

- [ ] **Step 2: Add message listener to the native module**

The exact implementation depends on the existing module structure found in Step 1. The pattern:

1. In the Swift module, implement `WCSessionDelegate.session(_:didReceiveMessage:replyHandler:)`
2. When a message arrives, emit an Expo event: `sendEvent("onWatchMessage", body: message)`
3. Reply with `["ok": true]` so the watch gets confirmation

- [ ] **Step 3: Add JS listener in the mobile app**

Create `apps/mobile/hooks/useWatchMessages.ts`:

```typescript
import { useEffect } from 'react'
import { Platform } from 'react-native'
import { useOfflineWrite } from './useOfflineWrite'
import { useApp } from '../context/AppContext'
import type { OfflineEntryKind } from '../store/offlineQueue'
import type { EventType } from '@carelog/types'

/**
 * Listens for quick-log messages from the Apple Watch and enqueues them
 * into the shared offline queue. No-op on Android.
 */
export function useWatchMessages() {
  const { orgId, recipientId } = useApp()
  const { write } = useOfflineWrite(orgId ?? '')

  useEffect(() => {
    if (Platform.OS !== 'ios' || !orgId || !recipientId) return

    let subscription: { remove: () => void } | null = null
    try {
      const { requireNativeModule } = require('expo-modules-core')
      const mod = requireNativeModule('CarelogWatch')

      subscription = mod.addListener('onWatchMessage', (message: Record<string, unknown>) => {
        const type = message.type as string
        const payload = message.payload as Record<string, unknown>

        const entryKindMap: Record<string, OfflineEntryKind> = {
          medication_log: 'medication_log',
          journal_entry: 'journal_entry',
        }

        const eventTypeMap: Record<string, EventType> = {
          medication_log: 'medication',
          journal_entry: 'journal',
        }

        const entryKind = entryKindMap[type]
        const eventType = eventTypeMap[type]

        if (entryKind && eventType) {
          write({
            event_type: eventType,
            entry_kind: entryKind,
            payload,
            recipient_id: recipientId,
          }).catch(console.error)
        }
      })
    } catch {
      // Native module not available (Expo Go, Android, etc.)
    }

    return () => subscription?.remove()
  }, [orgId, recipientId])
}
```

- [ ] **Step 4: Wire useWatchMessages into root layout**

In `apps/mobile/app/_layout.tsx`, add the hook inside `RootLayout`:

```typescript
import { useWatchMessages } from '../hooks/useWatchMessages'

export default function RootLayout() {
  // ... existing code ...
  useWatchMessages()
  // ... rest of component ...
}
```

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/modules/carelog-watch/ apps/mobile/hooks/useWatchMessages.ts apps/mobile/app/_layout.tsx
git commit -m "feat(mobile): handle watch quick-log messages and enqueue to offline queue"
```

---

### Task 7: Update writeWatchData to send medications list

**Files:**
- Modify: `apps/mobile/modules/carelog-watch/index.ts`
- Modify: `apps/mobile/app/(app)/medications/index.tsx`

- [ ] **Step 1: Extend WatchData type to include medications array**

In `apps/mobile/modules/carelog-watch/index.ts`, update the `WatchData` type:

```typescript
export type WatchData = {
  nextShift?: { assigneeName: string; startsAt: string } | null
  nextMedication?: { id: string; name: string; dosage: string; dueAt: string; scheduledTime: string } | null
  medications?: Array<{ id: string; name: string; dosage: string; dueAt: string; scheduledTime: string }>
}
```

- [ ] **Step 2: Update medications screen to send full med list to watch**

In `apps/mobile/app/(app)/medications/index.tsx`, update the `useEffect` that calls `writeWatchData` to also send the full medications list:

```typescript
  useEffect(() => {
    if (!scheduled) return
    const meds = scheduled as unknown as ScheduledMed[]
    const medList = meds
      .filter((m) => m.medications?.[0])
      .map((m) => ({
        id: m.medications![0].id,
        name: m.medications![0].drug_name,
        dosage: m.medications![0].dosage,
        dueAt: m.scheduled_time,
        scheduledTime: m.scheduled_time,
      }))
    const next = medList[0]
    writeWatchData({
      nextMedication: next ?? null,
      medications: medList,
    })
  }, [scheduled])
```

- [ ] **Step 3: Run tests to verify nothing broke**

Run: `cd apps/mobile && npx jest --verbose`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/modules/carelog-watch/index.ts apps/mobile/app/(app)/medications/index.tsx
git commit -m "feat(mobile): send full medications list to watch for quick-log"
```

---

### Task 8: Verify end-to-end on simulator

**Files:** None (manual verification)

- [ ] **Step 1: Run expo prebuild**

Run: `cd apps/mobile && npx expo prebuild --clean --platform ios`
Expected: Generates `ios/` directory with CarelogWatch target

- [ ] **Step 2: Open in Xcode and verify watch target exists**

Open `apps/mobile/ios/Carelog.xcworkspace` in Xcode. Verify:
- CarelogWatch target appears in the target list
- All 6 Swift files are included: `CarelogWatchApp.swift`, `ContentView.swift`, `WatchViewModel.swift`, `MedConfirmView.swift`, `MoodPulseView.swift`, `ComplicationProvider.swift`
- Build succeeds for both the main app and watch target

- [ ] **Step 3: Test on watch simulator**

1. Select the CarelogWatch scheme
2. Run on Apple Watch simulator
3. Verify: ContentView renders with "All caught up" empty state
4. Verify: "Log mood" button appears and navigates to MoodPulseView

- [ ] **Step 4: Commit any final adjustments**

```bash
git add -A
git commit -m "feat(watch): Apple Watch companion v1 complete"
```
