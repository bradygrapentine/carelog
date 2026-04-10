import { useEffect } from 'react'
import { Stack, useRouter } from 'expo-router'
import { getSession } from '../../utils/auth'

export default function AuthLayout() {
  const router = useRouter()

  useEffect(() => {
    getSession().then((session) => {
      if (session) router.replace('/(app)')
    })
  }, [])

  return <Stack screenOptions={{ headerShown: false }} />
}
