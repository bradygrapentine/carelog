/**
 * Central registry for all SecureStore key strings.
 *
 * Rationale: Hardcoded string literals were scattered across 5 production files
 * (sign-in.tsx, verify.tsx, invite/[token].tsx, onboarding.ts, offlineQueue.ts)
 * with no namespacing or versioning. This registry:
 *  1. Gives every key a "v1:carelog:" namespace so future key renames can be
 *     done with a version bump without data loss.
 *  2. Makes typos impossible (TypeScript const-narrowing catches wrong spellings).
 *  3. Documents the migration path for existing installs (see migratedGet below).
 *
 * Migration note: any user who installed before this registry was introduced will
 * have data stored under the old (un-namespaced) key. migratedGet() reads the new
 * key first; if absent, falls back to the old key, migrates the value in-place,
 * then deletes the old key. This is a one-shot migration — after first run the old
 * key is gone.
 */
import * as SecureStore from "expo-secure-store";

export const KEYS = {
  onboarding: "v1:carelog:onboarding_complete",
  offlineQueue: "v1:carelog:offline_queue",
  pendingEmail: "v1:carelog:pending_email",
  pendingInviteToken: "v1:carelog:pending_invite_token",
} as const;

/**
 * One-shot migration read: returns the value stored under newKey, or — if absent
 * — reads from oldKey, writes it to newKey, deletes oldKey, and returns the value.
 *
 * Call at every read site during the first install cycle after the key registry
 * was introduced. Write sites can use KEYS.X directly (they already write the new
 * key going forward; the migration path only matters for reads of pre-existing data).
 */
export async function migratedGet(
  newKey: string,
  oldKey: string,
): Promise<string | null> {
  const value = await SecureStore.getItemAsync(newKey);
  if (value !== null) return value;

  const old = await SecureStore.getItemAsync(oldKey);
  if (old !== null) {
    await SecureStore.setItemAsync(newKey, old);
    await SecureStore.deleteItemAsync(oldKey);
    return old;
  }
  return null;
}
