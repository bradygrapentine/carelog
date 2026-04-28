import type { Metadata } from "next";
import { ForReferrersPage } from "../../../components/marketing/ForReferrersPage";

const BASE_URL = "https://care-log.org";

export const metadata: Metadata = {
  title: "For Referrers — Carelog",
  description:
    "Recommend Carelog to the families you work with. A caregiving coordination platform for medications, aide scheduling, and the whole care team — built for social workers, discharge planners, elder law attorneys, and geriatric care managers to refer with confidence.",
  alternates: { canonical: `${BASE_URL}/for-referrers` },
  openGraph: {
    title: "For Referrers — Carelog",
    description:
      "Recommend Carelog to the families you work with. Built for social workers, discharge planners, elder law attorneys, and geriatric care managers to refer with confidence.",
    url: `${BASE_URL}/for-referrers`,
    siteName: "Carelog",
    images: [
      {
        url: `${BASE_URL}/og-image.png`,
        width: 1200,
        height: 630,
        alt: "Carelog for Referrers",
      },
    ],
    type: "website",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "For Referrers — Carelog",
    description:
      "Recommend Carelog to the families you work with. Built for social workers, discharge planners, elder law attorneys, and geriatric care managers to refer with confidence.",
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
