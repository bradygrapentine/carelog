import { useEffect } from "react";
import { Stack, useRouter } from "expo-router";
import { getSession } from "../../utils/auth";
import { useAppTheme } from "../../hooks/useAppTheme";

// ts-prune-ignore-next // Expo Router layout page component
export default function AuthLayout() {
  const router = useRouter();
  const { colors } = useAppTheme();

  useEffect(() => {
    getSession().then((session) => {
      if (session) router.replace("/(app)");
    });
  }, []);

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.surface },
      }}
    />
  );
}
