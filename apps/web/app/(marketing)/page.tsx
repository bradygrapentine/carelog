import type { Metadata } from "next";
import { HeroSection } from "../../components/marketing/HeroSection";
import { FeatureGrid } from "../../components/marketing/FeatureGrid";
import { HowItWorks } from "../../components/marketing/HowItWorks";
import { Testimonials } from "../../components/marketing/Testimonials";

const BASE_URL = "https://care-log.org";

// SEO-001: title is intent-shaped — leads with "Family Caregiving App"
// to land on long-tail "caregiving app for aging parents" queries while
// still anchoring on the brand. ≤60 chars.
const TITLE = "CareSync — Family Caregiving App for Aging Parents";
const DESCRIPTION =
  "Coordinate care for an aging parent without the group-text chaos. CareSync is a shared caregiver journal, medication tracker, and shift schedule for your whole family.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: BASE_URL },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: BASE_URL,
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

const organizationJsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "CareSync",
  url: BASE_URL,
  logo: `${BASE_URL}/og-image.png`,
  contactPoint: {
    "@type": "ContactPoint",
    email: "hello@care-log.org",
    contactType: "customer support",
  },
};

const softwareApplicationJsonLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "CareSync",
  applicationCategory: "HealthApplication",
  operatingSystem: "Web, iOS, Android",
  url: BASE_URL,
  description:
    "Family caregiving coordination platform. Track medications, schedule caregiver shifts, and keep the whole care team in sync.",
  offers: {
    "@type": "Offer",
    price: "14",
    priceCurrency: "USD",
    billingIncrement: "P1M",
  },
};

export default function LandingPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(softwareApplicationJsonLd),
        }}
      />
      <HeroSection />
      <FeatureGrid />
      <HowItWorks />
      <Testimonials />
    </>
  );
}
