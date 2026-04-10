import { useState } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, Alert, Platform } from 'react-native'
import { useRouter } from 'expo-router'
import * as Notifications from 'expo-notifications'
import { signOut, getAccessToken } from '../../../utils/auth'

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000'

async function registerPushToken(): Promise<void> {
  const { status: existing } = await Notifications.getPermissionsAsync()
  let finalStatus = existing

  if (existing !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync()
    finalStatus = status
  }

  if (finalStatus !== 'granted') {
    Alert.alert('Notifications blocked', 'Enable notifications in Settings to receive alerts.')
    return
  }

  const tokenData = await Notifications.getExpoPushTokenAsync()
  const token = tokenData.data

  const accessToken = await getAccessToken()
  const res = await fetch(API_URL + '/api/push/register', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(accessToken ? { authorization: 'Bearer ' + accessToken } : {}),
    },
    body: JSON.stringify({ token, platform: Platform.OS }),
  })

  if (!res.ok) {
    throw new Error('Registration failed: ' + res.status)
  }
}

export default function SettingsScreen() {
  const router = useRouter()
  const [registering, setRegistering] = useState(false)

  async function handleSignOut() {
    await signOut()
    router.replace('/(auth)/sign-in')
  }

  async function handleEnableNotifications() {
    setRegistering(true)
    try {
      await registerPushToken()
      Alert.alert('Notifications enabled', 'You will now receive alerts for this org.')
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Could not enable notifications.')
    } finally {
      setRegistering(false)
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Settings</Text>

      <TouchableOpacity
        style={styles.notifBtn}
        onPress={handleEnableNotifications}
        disabled={registering}
      >
        <Text style={styles.notifText}>
          {registering ? 'Enabling…' : 'Enable push notifications'}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.signOutBtn} onPress={handleSignOut}>
        <Text style={styles.signOutText}>Sign out</Text>
      </TouchableOpacity>
    </View>
  )
}

const styles = StyleSheet.create({
  container:   { flex: 1, padding: 16, backgroundColor: '#fff' },
  title:       { fontSize: 22, fontWeight: '700', marginBottom: 24, marginTop: 8 },
  notifBtn:    { borderWidth: 1, borderColor: '#7c3aed', borderRadius: 8, padding: 14, alignItems: 'center', marginBottom: 12 },
  notifText:   { color: '#7c3aed', fontWeight: '600' },
  signOutBtn:  { borderWidth: 1, borderColor: '#ef4444', borderRadius: 8, padding: 14, alignItems: 'center' },
  signOutText: { color: '#ef4444', fontWeight: '600' },
})
