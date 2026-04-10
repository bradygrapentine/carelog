import { useEffect, useState } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import * as SecureStore from 'expo-secure-store'
import { getSession } from '../../../utils/auth'

type InviteDetails = {
  org_name: string
  role: string
  invited_by: string
}

export default function InviteScreen() {
  const { token } = useLocalSearchParams<{ token: string }>()
  const router = useRouter()
  const [details, setDetails] = useState<InviteDetails | null>(null)
  const [loading, setLoading] = useState(true)
  const [accepting, setAccepting] = useState(false)
  const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000'

  useEffect(() => {
    async function init() {
      const session = await getSession()
      if (!session) {
        await SecureStore.setItemAsync('pending_invite_token', token)
        router.replace('/(auth)/sign-in')
        return
      }
      const res = await fetch(`${API_URL}/api/invite/${token}`)
      if (!res.ok) { setLoading(false); return }
      const data = await res.json() as InviteDetails
      setDetails(data)
      setLoading(false)
    }
    init()
  }, [token])

  async function handleAccept() {
    setAccepting(true)
    const session = await getSession()
    const res = await fetch(`${API_URL}/api/invite/${token}/accept`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session?.access_token ?? ''}`,
      },
    })
    setAccepting(false)
    if (!res.ok) {
      Alert.alert('Error', 'Could not accept invite. It may have already been used.')
      return
    }
    await SecureStore.deleteItemAsync('pending_invite_token')
    router.replace('/(app)/journal')
  }

  if (loading) return <ActivityIndicator style={{ flex: 1 }} size="large" color="#0369a1" />

  if (!details) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Invite not found</Text>
        <Text style={styles.subtitle}>This invite may have expired or already been used.</Text>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>You're invited!</Text>
      <Text style={styles.subtitle}>
        {details.invited_by} invited you to join {details.org_name} as a {details.role}.
      </Text>
      <TouchableOpacity style={styles.btn} onPress={handleAccept} disabled={accepting}>
        <Text style={styles.btnText}>{accepting ? 'Joining…' : 'Accept invite'}</Text>
      </TouchableOpacity>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 24, backgroundColor: '#fff' },
  title: { fontSize: 24, fontWeight: '700', marginBottom: 8 },
  subtitle: { fontSize: 16, color: '#6b7280', marginBottom: 32, lineHeight: 24 },
  btn: { backgroundColor: '#0369a1', borderRadius: 8, padding: 16, alignItems: 'center' },
  btnText: { color: '#fff', fontWeight: '600', fontSize: 16 },
})
