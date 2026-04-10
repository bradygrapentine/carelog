import { useState, useEffect } from 'react'
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from 'react-native'
import { useRouter } from 'expo-router'
import * as SecureStore from 'expo-secure-store'
import { supabase } from '../../utils/supabase'

export default function VerifyScreen() {
  const [code, setCode] = useState('')
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  useEffect(() => {
    SecureStore.getItemAsync('pending_email').then((e) => { if (e) setEmail(e) })
  }, [])

  async function handleVerify() {
    if (code.length !== 6) return

    setLoading(true)
    const { error } = await supabase.auth.verifyOtp({ email, token: code, type: 'email' })
    setLoading(false)

    if (error) {
      Alert.alert('Invalid code', 'Please check the code and try again.')
      return
    }

    await SecureStore.deleteItemAsync('pending_email')

    const pendingInvite = await SecureStore.getItemAsync('pending_invite_token')
    if (pendingInvite) {
      router.replace({ pathname: '/(app)/invite/[token]', params: { token: pendingInvite } })
    } else {
      router.replace('/(app)')
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Check your email</Text>
      <Text style={styles.subtitle}>Enter the 6-digit code sent to {email}</Text>
      <TextInput
        style={styles.input}
        placeholder="123456"
        value={code}
        onChangeText={setCode}
        keyboardType="number-pad"
        maxLength={6}
        autoFocus
      />
      <TouchableOpacity style={styles.button} onPress={handleVerify} disabled={loading || code.length !== 6}>
        <Text style={styles.buttonText}>{loading ? 'Verifying…' : 'Verify'}</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.back} onPress={() => router.back()}>
        <Text style={styles.backText}>← Use a different email</Text>
      </TouchableOpacity>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 24, backgroundColor: '#fff' },
  title: { fontSize: 24, fontWeight: '700', marginBottom: 8 },
  subtitle: { fontSize: 15, color: '#6b7280', marginBottom: 32 },
  input: { borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8, padding: 14, fontSize: 24, letterSpacing: 8, textAlign: 'center', marginBottom: 16 },
  button: { backgroundColor: '#0369a1', borderRadius: 8, padding: 14, alignItems: 'center' },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  back: { marginTop: 16, alignItems: 'center' },
  backText: { color: '#6b7280', fontSize: 14 },
})
