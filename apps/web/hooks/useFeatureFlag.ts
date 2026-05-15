"use client";

import { useFeatureFlagEnabled } from "posthog-js/react";

/**
 * Client-side feature flag hook.
 *
 * Wraps posthog-js/react's useFeatureFlagEnabled with a fail-closed default.
 * Returns false when PostHog hasn't loaded yet or the flag is not defined.
 *
 * Usage:
 *   const isOn = useFeatureFlag('feature_my_feature');
 *
 * See docs/adr/0004-feature-flag-rollout-pattern.md for rollout guidance.
 */
export function useFeatureFlag(flag: string): boolean {
  return useFeatureFlagEnabled(flag) ?? false;
}
