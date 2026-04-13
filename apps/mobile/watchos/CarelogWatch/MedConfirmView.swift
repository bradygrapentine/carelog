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
