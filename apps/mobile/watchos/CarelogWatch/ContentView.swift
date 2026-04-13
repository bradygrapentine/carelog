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
