import { useEffect } from "react";
import { Tabs, useRouter } from "expo-router";
import { getSession } from "../../utils/auth";

export default function AppLayout() {
  const router = useRouter();

  useEffect(() => {
    getSession().then((session) => {
      if (!session) router.replace("/(auth)/sign-in");
    });
  }, []);

  return (
    <Tabs screenOptions={{ tabBarActiveTintColor: "#0369a1" }}>
      <Tabs.Screen name="index" options={{ title: "Home", href: null }} />
      <Tabs.Screen name="journal/index" options={{ title: "Journal" }} />
      <Tabs.Screen name="journal/[eventId]" options={{ href: null }} />
      <Tabs.Screen
        name="medications/index"
        options={{ title: "Medications" }}
      />
      <Tabs.Screen name="schedule/index" options={{ title: "Schedule" }} />
      <Tabs.Screen name="team/index" options={{ title: "Team" }} />
      <Tabs.Screen name="more/index" options={{ title: "More" }} />
      <Tabs.Screen name="invite/[token]" options={{ href: null }} />
      <Tabs.Screen name="settings/index" options={{ title: "Settings" }} />
      {/* Sub-screens accessible via router.push, hidden from tabs */}
      <Tabs.Screen name="symptoms/index" options={{ href: null }} />
      <Tabs.Screen name="symptoms/log" options={{ href: null }} />
      <Tabs.Screen name="burnout/index" options={{ href: null }} />
      <Tabs.Screen name="burnout/checkin" options={{ href: null }} />
      <Tabs.Screen name="burnout/summary" options={{ href: null }} />
      <Tabs.Screen name="expenses/index" options={{ href: null }} />
      <Tabs.Screen name="expenses/add" options={{ href: null }} />
      <Tabs.Screen name="documents/index" options={{ href: null }} />
      <Tabs.Screen name="outer-circle/index" options={{ href: null }} />
      <Tabs.Screen name="care-brief/index" options={{ href: null }} />
      <Tabs.Screen name="benefits/index" options={{ href: null }} />
      <Tabs.Screen name="eol-planner/index" options={{ href: null }} />
    </Tabs>
  );
}
