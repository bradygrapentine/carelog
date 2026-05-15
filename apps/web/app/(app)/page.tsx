"use client";

// Reference call site for useFeatureFlag — see docs/adr/0004-feature-flag-rollout-pattern.md
// This pattern shows how to gate UI behind a feature flag. The flag itself is
// toggled in the PostHog UI; no deploy needed to change rollout percentage.
//
// Example usage (non-visible, greppable for future contributors):
//   const isTestFlagOn = useFeatureFlag('feature_test_flag');
//   <!-- feature_test_flag is ON -->
//
// For server-side evaluation, use getFeatureFlag() from @/lib/featureFlags.

import { useFeatureFlag } from "@/hooks/useFeatureFlag";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function AppRootPage() {
  const router = useRouter();
  // Reference: demonstrate useFeatureFlag usage (invisible to users).
  // The flag value is intentionally unused here; this is the greppable example.
  const _featureTestFlag = useFeatureFlag("feature_test_flag");

  useEffect(() => {
    router.replace("/dashboard");
  }, [router]);

  // data-feature-test-flag is invisible to users but greppable by devs
  return (
    <div
      aria-hidden="true"
      data-feature-test-flag={String(_featureTestFlag)}
      style={{ display: "none" }}
    />
  );
}
