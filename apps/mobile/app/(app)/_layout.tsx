import { useEffect } from 'react'
import { Tabs, useRouter } from 'expo-router'
import { getSession } from '../../utils/auth'

export default function AppLayout() {
  const router = useRouter()

  useEffect(() => {
    getSession().then((session) => {
      if (!session) router.replace('/(auth)/sign-in')
    })
  }, [])

  return (
    <Tabs screenOptions={{ tabBarActiveTintColor: '#0369a1' }}>
      <Tabs.Screen name="index" options={{ title: 'Home', href: null }} />
      <Tabs.Screen name="journal/index" options={{ title: 'Journal' }} />
      <Tabs.Screen name="medications/index" options={{ title: 'Medications' }} />
      <Tabs.Screen name="schedule/index" options={{ title: 'Schedule' }} />
      <Tabs.Screen name="invite/[token]" options={{ href: null }} />
      <Tabs.Screen name="settings/index" options={{ title: 'Settings' }} />
    </Tabs>
  )
}
