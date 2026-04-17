import { Stack } from "expo-router";
import { useAppTheme } from "../../../hooks/useAppTheme";

// ts-prune-ignore-next // Expo Router layout page component
export default function OnboardingLayout() {
  const { colors } = useAppTheme();

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.surface },
      }}
    />
  );
}
