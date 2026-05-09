import type { Metadata } from "next";
import { ForReferrersPage } from "../../../components/marketing/ForReferrersPage";

const BASE_URL = "https://care-log.org";

// SEO-001: target the professional referrer audience explicitly so the
// page surfaces on "elder care referral platform" / "discharge planner
// caregiving tool" queries. ≤60 chars.
const TITLE = "Refer CareSync — for Social Workers & Care Managers";
const DESCRIPTION =
  "Recommend CareSync to the families you work with. Built for social workers, discharge planners, elder law attorneys, and geriatric care managers to refer with confidence.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: `${BASE_URL}/for-referrers` },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: `${BASE_URL}/for-referrers`,
    siteName: "CareSync",
    images: [
      {
        url: `${BASE_URL}/og-image.png`,
        width: 1200,
        height: 630,
        alt: TITLE,
      },
    ],
    type: "website",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
    images: [`${BASE_URL}/og-image.png`],
  },
};

export default function ForReferrersLandingPage() {
  return (
    <div className="py-20">
      <ForReferrersPage />
    </div>
  );
}
