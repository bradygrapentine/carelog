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
