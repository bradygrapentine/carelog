import * as SecureStore from "expo-secure-store";

export const ONBOARDING_KEY = "onboarding_complete";

export async function completeOnboarding(): Promise<void> {
  await SecureStore.setItemAsync(ONBOARDING_KEY, "true");
}

export async function isOnboardingComplete(): Promise<boolean> {
  const value = await SecureStore.getItemAsync(ONBOARDING_KEY);
  return value === "true";
}
