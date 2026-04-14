import { HeroSection } from "../../components/marketing/HeroSection";
import { FeatureGrid } from "../../components/marketing/FeatureGrid";
import { ProductPreview } from "../../components/marketing/ProductPreview";
import { PricingPreview } from "../../components/marketing/PricingPreview";

export default function LandingPage() {
  return (
    <>
      <HeroSection />
      <FeatureGrid />
      <ProductPreview />
      <PricingPreview />
    </>
  );
}
