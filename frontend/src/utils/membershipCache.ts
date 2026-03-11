/**
 * Membership record cache — persists CircleMembership record plaintexts in
 * localStorage so contribute/claim_payout can find them even if
 * requestRecords() is slow or returns no results on first call.
 *
 * Cache entries expire after 48 hours (records are long-lived on Aleo testnet).
 */

const CACHE_KEY = 'zkcircles_membership_records'
const TTL_MS = 48 * 60 * 60 * 1_000 // 48 hours

interface CacheEntry {
  plaintext: string
  cachedAt: number
}

type MembershipCache = Record<string, CacheEntry>

function readCache(): MembershipCache {
  try {
    return JSON.parse(localStorage.getItem(CACHE_KEY) || '{}')
  } catch {
    return {}
  }
}

function writeCache(cache: MembershipCache): void {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache))
  } catch { /* quota exceeded — ignore */ }
}

function cacheKey(address: string, circleId: string): string {
  return `${address}:${circleId}`
}

/** Return a cached record plaintext, or null if not found / expired. */
export function getCachedMembership(address: string, circleId: string): string | null {
  const cache = readCache()
  const entry = cache[cacheKey(address, circleId)]
  if (!entry) return null
  if (Date.now() - entry.cachedAt > TTL_MS) {
    // Expired — evict
    delete cache[cacheKey(address, circleId)]
    writeCache(cache)
    return null
  }
  return entry.plaintext
}

/** Save a record plaintext for fast lookup on next contribute/claim. */
export function setCachedMembership(address: string, circleId: string, plaintext: string): void {
  const cache = readCache()
  cache[cacheKey(address, circleId)] = { plaintext, cachedAt: Date.now() }
  writeCache(cache)
}

/** Remove a cached record (e.g. after payout is claimed and record is consumed). */
export function clearCachedMembership(address: string, circleId: string): void {
  const cache = readCache()
  delete cache[cacheKey(address, circleId)]
  writeCache(cache)
}

/**
 * Build a partial CircleMembership plaintext from known fields.
 *
 * Shield Wallet can match this against its internal record store even without
 * the `_nonce`, because it resolves records by commitment when executing
 * transactions. Used as the last-resort fallback when requestRecords returns
 * nothing.
 *
 * Format matches the Leo record layout:
 *   record CircleMembership { owner: address, circle_id: field, contribution_amount: u64 }
 */
export function synthesizeMembershipRecord(
  owner: string,
  circleId: string,
  contributionAmount: number
): string {
  const ownerField = owner.endsWith('.private') ? owner : `${owner}.private`
  const idField = circleId.includes('.private') || circleId.includes('.public')
    ? circleId
    : `${circleId}.private`
  const amtField = `${contributionAmount}u64.private`

  return `{\n  owner: ${ownerField},\n  circle_id: ${idField},\n  contribution_amount: ${amtField}\n}`
}
