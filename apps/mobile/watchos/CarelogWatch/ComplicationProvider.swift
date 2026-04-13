import ClockKit
import WatchConnectivity

class ComplicationProvider: NSObject, CLKComplicationDataSource {

  // MARK: — Timeline Configuration

  func getComplicationDescriptors(handler: @escaping ([CLKComplicationDescriptor]) -> Void) {
    let descriptors = [
      CLKComplicationDescriptor(
        identifier: "nextMedication",
        displayName: "Next Medication",
        supportedFamilies: [.graphicRectangular]
      ),
      CLKComplicationDescriptor(
        identifier: "shiftStatus",
        displayName: "Shift Status",
        supportedFamilies: [.graphicCircular]
      ),
    ]
    handler(descriptors)
  }

  func getCurrentTimelineEntry(
    for complication: CLKComplication,
    withHandler handler: @escaping (CLKComplicationTimelineEntry?) -> Void
  ) {
    let ctx = WCSession.default.receivedApplicationContext

    switch complication.identifier {
    case "nextMedication":
      if let med = ctx["nextMedication"] as? [String: String],
         let name = med["name"],
         let dueAt = med["dueAt"] {
        let dosage = med["dosage"] ?? ""
        let template = CLKComplicationTemplateGraphicRectangularStandardBody(
          headerTextProvider: CLKTextProvider(format: "💊 %@", name),
          body1TextProvider: CLKTextProvider(format: "%@ · %@", dosage, dueAt)
        )
        handler(CLKComplicationTimelineEntry(date: Date(), complicationTemplate: template))
      } else {
        let template = CLKComplicationTemplateGraphicRectangularStandardBody(
          headerTextProvider: CLKTextProvider(format: "No medications"),
          body1TextProvider: CLKTextProvider(format: "All caught up")
        )
        handler(CLKComplicationTimelineEntry(date: Date(), complicationTemplate: template))
      }

    case "shiftStatus":
      if let shift = ctx["nextShift"] as? [String: String],
         let assignee = shift["assigneeName"],
         let startsAt = shift["startsAt"] {
        let initial = String(assignee.prefix(1))
        let template = CLKComplicationTemplateGraphicCircularStackText(
          line1TextProvider: CLKTextProvider(format: initial),
          line2TextProvider: CLKTextProvider(format: formatShortTime(startsAt))
        )
        handler(CLKComplicationTimelineEntry(date: Date(), complicationTemplate: template))
      } else {
        let template = CLKComplicationTemplateGraphicCircularStackText(
          line1TextProvider: CLKTextProvider(format: "—"),
          line2TextProvider: CLKTextProvider(format: "Off")
        )
        handler(CLKComplicationTimelineEntry(date: Date(), complicationTemplate: template))
      }

    default:
      handler(nil)
    }
  }

  func getTimelineEndDate(
    for complication: CLKComplication,
    withHandler handler: @escaping (Date?) -> Void
  ) {
    // Timeline entries are refreshed when phone pushes new context
    handler(Date().addingTimeInterval(60 * 60)) // 1 hour ahead
  }

  func getPrivacyBehavior(
    for complication: CLKComplication,
    withHandler handler: @escaping (CLKComplicationPrivacyBehavior) -> Void
  ) {
    handler(.showOnLockScreen)
  }

  // MARK: — Private

  private func formatShortTime(_ iso: String) -> String {
    let formatter = ISO8601DateFormatter()
    formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
    if let date = formatter.date(from: iso) {
      let remaining = date.timeIntervalSince(Date())
      if remaining > 0 {
        let hours = Int(remaining) / 3600
        let minutes = (Int(remaining) % 3600) / 60
        if hours > 0 { return "\(hours)h" }
        return "\(minutes)m"
      }
      return "Now"
    }
    return "—"
  }
}
