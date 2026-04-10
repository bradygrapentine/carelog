import { useState } from 'react'
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from 'react-native'
import { useRouter } from 'expo-router'
import * as SecureStore from 'expo-secure-store'
import { supabase } from '../../utils/supabase'

export default function SignInScreen() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleSubmit() {
    const trimmed = email.trim().toLowerCase()
    if (!trimmed) return

    setLoading(true)
    const { error } = await supabase.auth.signInWithOtp({ email: trimmed })
    setLoading(false)

    if (error) {
      Alert.alert('Error', error.message)
      return
    }

    await SecureStore.setItemAsync('pending_email', trimmed)
    router.push('/(auth)/verify')
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Sign in to Carelog</Text>
      <Text style={styles.subtitle}>We'll send a 6-digit code to your email.</Text>
      <TextInput
        style={styles.input}
        placeholder="your@email.com"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
        autoFocus
      />
      <TouchableOpacity style={styles.button} onPress={handleSubmit} disabled={loading}>
        <Text style={styles.buttonText}>{loading ? 'Sending…' : 'Send code'}</Text>
      </TouchableOpacity>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 24, backgroundColor: '#fff' },
  title: { fontSize: 24, fontWeight: '700', marginBottom: 8 },
  subtitle: { fontSize: 15, color: '#6b7280', marginBottom: 32 },
  input: { borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8, padding: 14, fontSize: 16, marginBottom: 16 },
  button: { backgroundColor: '#0369a1', borderRadius: 8, padding: 14, alignItems: 'center' },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
})
