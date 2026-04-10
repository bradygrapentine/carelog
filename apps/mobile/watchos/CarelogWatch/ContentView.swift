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
