import * as SecureStore from "expo-secure-store";
import { KEYS, migratedGet } from "./secureStoreKeys";

/** @deprecated Use KEYS.onboarding from secureStoreKeys instead.
 *  Kept for any consumer that imports this symbol directly — remove after one release cycle. */
export const ONBOARDING_KEY = KEYS.onboarding;

export async function completeOnboarding(): Promise<void> {
  await SecureStore.setItemAsync(KEYS.onboarding, "true");
}

export async function isOnboardingComplete(): Promise<boolean> {
  // migratedGet handles devices that stored the value under the pre-registry key
  // "onboarding_complete" (before v1:carelog: namespace was introduced).
  const value = await migratedGet(KEYS.onboarding, "onboarding_complete");
  return value === "true";
}
