import type { Metadata } from "next";
import { CareZoneAlternativePage } from "../../../components/marketing/CareZoneAlternativePage";
import { CareZoneMedicationImport } from "../../../components/marketing/CareZoneMedicationImport";

export const metadata: Metadata = {
  title: "CareZone Alternative — CareSync",
  description:
    "Looking for a CareZone alternative? CareSync offers everything CareZone had — plus a full care team, shift scheduling, and caregiver burnout support. Start free.",
};

export default function CareZoneAlternativeLandingPage() {
  return (
    <div className="py-20">
      <CareZoneAlternativePage />
      <CareZoneMedicationImport />
    </div>
  );
}
