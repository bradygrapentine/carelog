import WatchConnectivity

/// WCSessionDelegate for the phone side.
/// Handles lifecycle callbacks and forwards quick-log messages from the watch
/// to the Expo module via an event emitter closure.
class CarelogWatchDelegate: NSObject, WCSessionDelegate {
  static let shared = CarelogWatchDelegate()

  /// Set by CarelogWatchModule to forward incoming messages as Expo events
  var onMessage: (([String: Any]) -> Void)?

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

  /// Receive quick-log messages sent from the watch via sendMessage
  func session(
    _ session: WCSession,
    didReceiveMessage message: [String: Any],
    replyHandler: @escaping ([String: Any]) -> Void
  ) {
    onMessage?(message)
    replyHandler(["ok": true])
  }
}
