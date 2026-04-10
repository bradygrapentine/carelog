// Wave 3: real implementation — forwards to the CarelogWatch native module.
// Safe to call on Android or when no watch is paired (silently ignored).
export { writeWatchData } from '../modules/carelog-watch'
export type { WatchData } from '../modules/carelog-watch'
