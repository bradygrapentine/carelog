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
