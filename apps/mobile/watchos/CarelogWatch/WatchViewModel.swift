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
