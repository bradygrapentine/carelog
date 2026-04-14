import { HeroSection } from "../../components/marketing/HeroSection";
import { WhoItsFor } from "../../components/marketing/WhoItsFor";
import { FeatureGrid } from "../../components/marketing/FeatureGrid";
import { HowItWorks } from "../../components/marketing/HowItWorks";
import { ProductPreview } from "../../components/marketing/ProductPreview";
import { Testimonials } from "../../components/marketing/Testimonials";

export default function LandingPage() {
  return (
    <>
      <HeroSection />
      <WhoItsFor />
      <FeatureGrid />
      <HowItWorks />
      <ProductPreview />
      <Testimonials />
    </>
  );
}
