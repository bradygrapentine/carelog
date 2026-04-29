import type { Metadata } from "next";
import { CareZoneAlternativePage } from "../../../components/marketing/CareZoneAlternativePage";
import { CareZoneMedicationImport } from "../../../components/marketing/CareZoneMedicationImport";

const BASE_URL = "https://care-log.org";

export const metadata: Metadata = {
  title: "CareZone Alternative — CareSync",
  description:
    "Looking for a CareZone alternative? CareSync offers everything CareZone had — plus a full care team, shift scheduling, and caregiver burnout support. Start free.",
  alternates: { canonical: `${BASE_URL}/carezone-alternative` },
  openGraph: {
    title: "CareZone Alternative — CareSync",
    description:
      "Looking for a CareZone alternative? CareSync offers everything CareZone had — plus a full care team, shift scheduling, and caregiver burnout support. Start free.",
    url: `${BASE_URL}/carezone-alternative`,
    siteName: "CareSync",
    images: [
      {
        url: `${BASE_URL}/og-image.png`,
        width: 1200,
        height: 630,
        alt: "CareSync — CareZone Alternative",
      },
    ],
    type: "website",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "CareZone Alternative — CareSync",
    description:
      "Looking for a CareZone alternative? CareSync offers everything CareZone had — plus a full care team, shift scheduling, and caregiver burnout support. Start free.",
    images: [`${BASE_URL}/og-image.png`],
  },
};

export default function CareZoneAlternativeLandingPage() {
  return (
    <div className="py-20">
      <CareZoneAlternativePage />
      <CareZoneMedicationImport />
    </div>
  );
}
