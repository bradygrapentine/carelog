import { Platform } from 'react-native'

export type WatchData = {
  nextShift?: { assigneeName: string; startsAt: string } | null
  nextMedication?: { name: string; dueAt: string } | null
}

/**
 * Sends the latest shift/medication data to the paired Apple Watch.
 * Uses WCSession.updateApplicationContext — delivers latest-only (not queued).
 * Safe to call on Android or when no watch is paired (silently ignored).
 */
export function writeWatchData(data: WatchData): void {
  if (Platform.OS !== 'ios') return
  try {
    // Lazy require rather than top-level import: ensures the native module is only
    // loaded on iOS at call time, avoiding Metro bundler issues in Expo Go / Storybook
    // environments where the native CarelogWatch module isn't registered.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { requireNativeModule } = require('expo-modules-core')
    const mod = requireNativeModule('CarelogWatch')
    // Strip nulls — WCSession.updateApplicationContext cannot encode null
    const payload: Record<string, unknown> = {}
    if (data.nextShift) payload.nextShift = data.nextShift
    if (data.nextMedication) payload.nextMedication = data.nextMedication
    mod.writeWatchData(payload)
  } catch {
    // WCSession not reachable or module not registered on this build — silently ignore
  }
}
