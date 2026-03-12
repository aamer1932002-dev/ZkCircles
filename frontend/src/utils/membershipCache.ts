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
 * Decrypt a record ciphertext immediately (using the wallet view key) and cache
 * the resulting plaintext+nonce so the NEXT contribution/claim cycle can use it
 * WITHOUT waiting for the wallet to index the record.
 *
 * Key insight: `decrypt(ciphertext)` only needs the view key — it does NOT
 * require the record to be in the wallet's local database.  Passing a
 * plaintext+nonce to `executeTransaction` lets the wallet verify the record
 * commitment directly against the chain, bypassing the indexing requirement.
 *
 * Always returns a non-null string (falls back to the raw ciphertext on error
 * so callers can still attempt the transaction).
 */
export async function decryptAndCacheMembership(
  address: string,
  circleId: string,
  ciphertext: string,
  decrypt: (ct: string) => Promise<any>
): Promise<string> {
  try {
    const dec = await decrypt(ciphertext)
    const plaintext: string =
      typeof dec === 'string' ? dec : ((dec as any)?.text ?? String(dec))
    if (plaintext && plaintext.length > 10) {
      setCachedMembership(address, circleId, plaintext)
      console.log('[Cache] Decrypted & stored plaintext for', circleId.slice(0, 12) + '…')
      return plaintext
    }
  } catch (e) {
    console.warn('[Cache] decrypt() failed — caching raw ciphertext as fallback:', e)
  }
  // Fallback: cache the ciphertext
  setCachedMembership(address, circleId, ciphertext)
  return ciphertext
}

/**
 * For `contribute`, the TX emits (CircleMembership, ContributionReceipt, Future).
 * CircleMembership is the FIRST record output (index 0).
 * ContributionReceipt is the SECOND (index 1).
 *
 * This function fetches the specific record output by index from a TX.
 */
export async function fetchRecordByIndexFromChain(
  txId: string,
  programId: string,
  recordIndex: number
): Promise<string | null> {
  if (!txId || txId.startsWith('shield_') || txId.startsWith('mock_')) return null
  try {
    const url = `https://api.explorer.provable.com/v1/testnet/transaction/${txId}`
    const res = await fetch(url, { signal: AbortSignal.timeout(10_000) })
    if (!res.ok) return null
    const tx = await res.json()

    const transitions: any[] = tx?.execution?.transitions ?? []
    const programPrefix = programId.replace('.aleo', '')

    // First pass: only our program's transitions
    const records: string[] = []
    for (const t of transitions) {
      if (!t?.program?.startsWith(programPrefix)) continue
      for (const output of t?.outputs ?? []) {
        if (output.type === 'record' && output.value) {
          records.push(output.value as string)
        }
      }
    }
    if (records.length > recordIndex) {
      console.log(`[fetchRecordByIndex] Found record[${recordIndex}] in tx ${txId} (program filter)`)
      return records[recordIndex]
    }

    // Fallback: collect ALL record outputs (skipping fee/credits transitions)
    // in case the program field had unexpected formatting
    const allRecords: string[] = []
    for (const t of transitions) {
      // Skip pure credits transitions that are unlikely to be our membership record
      if (t?.program?.startsWith('credits') && t?.function !== 'contribute') {
        continue
      }
      for (const output of t?.outputs ?? []) {
        if (output.type === 'record' && output.value) {
          allRecords.push(output.value as string)
        }
      }
    }
    if (allRecords.length > recordIndex) {
      console.log(`[fetchRecordByIndex] Found record[${recordIndex}] in tx ${txId} (fallback, no program filter)`)
      return allRecords[recordIndex]
    }
    return null
  } catch (e) {
    console.warn('[fetchRecordByIndex] Error:', e)
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
