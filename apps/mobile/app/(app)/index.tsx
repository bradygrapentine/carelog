import { useEffect } from 'react'
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native'
import { useRouter } from 'expo-router'
import { trpc } from '../../utils/trpc'
import { useApp } from '../../context/AppContext'

export default function OrgSelectorScreen() {
  const router = useRouter()
  const { setOrg } = useApp()
  const { data: orgs, isLoading } = trpc.organizations.list.useQuery()

  useEffect(() => {
    if (orgs?.length === 1) {
      const org = orgs[0]
      setOrg(org.id, '', 'coordinator')
      router.replace('/(app)/journal')
    }
  }, [orgs])

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#0369a1" />
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Your care teams</Text>
      <FlatList
        data={orgs ?? []}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.card}
            onPress={() => {
              setOrg(item.id, '', 'coordinator')
              router.replace('/(app)/journal')
            }}
          >
            <Text style={styles.cardTitle}>{item.name}</Text>
          </TouchableOpacity>
        )}
        ListEmptyComponent={<Text style={styles.empty}>No care teams yet.</Text>}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: '#fff' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 22, fontWeight: '700', marginBottom: 16, marginTop: 48 },
  card: { borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 10, padding: 16, marginBottom: 10 },
  cardTitle: { fontSize: 17, fontWeight: '600' },
  empty: { color: '#9ca3af', textAlign: 'center', marginTop: 48 },
})
