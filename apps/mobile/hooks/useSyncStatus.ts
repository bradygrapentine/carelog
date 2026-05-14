import { useSyncStatusContext } from '../lib/syncStatusManager'

type SyncStatus = 'synced' | 'pending' | 'offline'

export function useSyncStatus(): SyncStatus {
  return useSyncStatusContext()
}
