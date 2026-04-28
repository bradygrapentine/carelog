import type { Metadata } from "next";
import { HeroSection } from "../../components/marketing/HeroSection";
import { WhoItsFor } from "../../components/marketing/WhoItsFor";
import { FeatureGrid } from "../../components/marketing/FeatureGrid";
import { HowItWorks } from "../../components/marketing/HowItWorks";
import { ProductPreview } from "../../components/marketing/ProductPreview";
import { Testimonials } from "../../components/marketing/Testimonials";

const BASE_URL = "https://care-log.org";

export const metadata: Metadata = {
  title: "Carelog — Family Caregiving Coordination",
  description:
    "Carelog helps families coordinate care for aging loved ones. Track medications, schedule shifts, share updates with the whole care team — all in one place.",
  alternates: {
    canonical: BASE_URL,
  },
  openGraph: {
    title: "Carelog — Family Caregiving Coordination",
    description:
      "Carelog helps families coordinate care for aging loved ones. Track medications, schedule shifts, share updates with the whole care team — all in one place.",
    url: BASE_URL,
    siteName: "Carelog",
    images: [
      {
        url: `${BASE_URL}/og-image.png`,
        width: 1200,
        height: 630,
        alt: "Carelog — Family Caregiving Coordination",
      },
    ],
    type: "website",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "Carelog — Family Caregiving Coordination",
    description:
      "Carelog helps families coordinate care for aging loved ones. Track medications, schedule shifts, share updates with the whole care team — all in one place.",
    images: [`${BASE_URL}/og-image.png`],
  },
};

const organizationJsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "Carelog",
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
  name: "Carelog",
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
      <WhoItsFor />
      <FeatureGrid />
      <HowItWorks />
      <ProductPreview />
      <Testimonials />
    </>
  );
}
