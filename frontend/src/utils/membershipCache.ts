/**
 * Membership record cache — persists CircleMembership record plaintexts AND
 * the join/create transaction IDs in localStorage so contribute/claim_payout
 * can find them even if requestRecords() is slow or returns no results.
 *
 * Cache entries expire after 48 hours.
 */

const CACHE_KEY = 'zkcircles_membership_records'
const TX_CACHE_KEY = 'zkcircles_join_txids'
const TTL_MS = 48 * 60 * 60 * 1_000 // 48 hours

interface CacheEntry {
  plaintext: string
  cachedAt: number
}

type MembershipCache = Record<string, CacheEntry>
type TxCache = Record<string, string> // key → txId

function readCache(): MembershipCache {
  try { return JSON.parse(localStorage.getItem(CACHE_KEY) || '{}') } catch { return {} }
}
function writeCache(cache: MembershipCache): void {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(cache)) } catch { /* quota */ }
}
function readTxCache(): TxCache {
  try { return JSON.parse(localStorage.getItem(TX_CACHE_KEY) || '{}') } catch { return {} }
}
function writeTxCache(cache: TxCache): void {
  try { localStorage.setItem(TX_CACHE_KEY, JSON.stringify(cache)) } catch { /* quota */ }
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

/** Remove a cached record (e.g. after payout is claimed). */
export function clearCachedMembership(address: string, circleId: string): void {
  const cache = readCache()
  delete cache[cacheKey(address, circleId)]
  writeCache(cache)
}

/** Store the transaction ID from create_circle / join_circle. */
export function setJoinTxId(address: string, circleId: string, txId: string): void {
  const cache = readTxCache()
  cache[cacheKey(address, circleId)] = txId
  writeTxCache(cache)
}

/** Retrieve the stored join/create transaction ID. */
export function getJoinTxId(address: string, circleId: string): string | null {
  return readTxCache()[cacheKey(address, circleId)] || null
}

/**
 * Fetch the CircleMembership record ciphertext directly from the Aleo testnet
 * by looking up the join/create transaction and reading its first record output.
 *
 * Shield Wallet accepts a ciphertext string (record1qyqsp…) and decrypts it
 * internally when building the proof — no view key needed on our side.
 */
export async function fetchRecordCiphertextFromChain(
  txId: string,
  programId: string
): Promise<string | null> {
  if (!txId || txId.startsWith('shield_') || txId.startsWith('mock_')) return null
  try {
    const url = `https://api.explorer.provable.com/v1/testnet/transaction/${txId}`
    const res = await fetch(url, { signal: AbortSignal.timeout(8_000) })
    if (!res.ok) return null
    const tx = await res.json()

    // Walk all transitions for this program and collect record outputs
    const transitions: any[] = [...(tx?.execution?.transitions ?? [])]
    if (tx?.fee?.transition) transitions.push(tx.fee.transition)

    for (const t of transitions) {
      if (!t?.program?.startsWith(programId.replace('.aleo', ''))) continue
      for (const output of t?.outputs ?? []) {
        if (output.type === 'record' && output.value) {
          console.log('[fetchRecordFromChain] Found ciphertext in tx', txId)
          return output.value as string
        }
      }
    }

    // If program filter missed, return any record output found
    for (const t of (tx?.execution?.transitions ?? [])) {
      for (const output of t?.outputs ?? []) {
        if (output.type === 'record' && output.value) {
          return output.value as string
        }
      }
    }
    return null
  } catch (e) {
    console.warn('[fetchRecordFromChain] Error:', e)
    return null
  }
}

/**
 * Build a partial CircleMembership plaintext from known fields AS LAST RESORT.
 * Without _nonce Shield Wallet cannot parse this as a record — only use this
 * to produce a descriptive error message, not as an actual transaction input.
 */
export function synthesizeMembershipRecord(
  owner: string,
  circleId: string,
  contributionAmount: number
): string {
  const ownerField = owner.endsWith('.private') ? owner : `${owner}.private`
  const idField = circleId.includes('.private') || circleId.includes('.public')
    ? circleId : `${circleId}.private`
  const amtField = `${contributionAmount}u64.private`
  return `{\n  owner: ${ownerField},\n  circle_id: ${idField},\n  contribution_amount: ${amtField}\n}`
}
