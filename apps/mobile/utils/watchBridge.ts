// Stub — replaced by native Expo Module in Wave 3 (watch complications)
// Safe to call on Android and when no watch is paired.

type WatchData = {
  nextShift?: { assigneeName: string; startsAt: string } | null
  nextMedication?: { name: string; dueAt: string } | null
}

export function writeWatchData(_data: WatchData): void {
  // no-op until CarelogWatch native module is wired in Wave 3
}
