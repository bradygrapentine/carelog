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
