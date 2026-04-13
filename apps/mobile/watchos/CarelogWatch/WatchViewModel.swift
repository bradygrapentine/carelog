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
    session?.sendMessage(message, replyHandler: { [weak self] _ in
      DispatchQueue.main.async {
        self?.lastLogConfirmation = med.name
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
