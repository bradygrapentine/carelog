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
