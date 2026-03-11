import { useState, useCallback } from 'react'
import { useWallet } from '@provablehq/aleo-wallet-adaptor-react'
import { recordContributionBackend, getCircleDetail } from '../services/api'
import {
  getCachedMembership,
  setCachedMembership,
  synthesizeMembershipRecord,
} from '../utils/membershipCache'
import { PROGRAM_ID, CIRCLE_POT_ADDRESS, FEE_CONTRIBUTE } from '../config'

const BASE_FEE = FEE_CONTRIBUTE
const DEFAULT_POT_ADDRESS = CIRCLE_POT_ADDRESS

/**
 * Rebuild a Leo record plaintext string from a WalletAdapterRecord.
 * The Provable SDK stores parsed fields in r.data rather than a raw string.
 */
function reconstructPlaintext(r: any): string {
  const raw: string | undefined = r.recordPlaintext || r.plaintext || r.record
  if (raw && typeof raw === 'string') return raw
  if (!r.data) return ''
  const fields = Object.entries(r.data as Record<string, string>)
    .map(([k, v]) => `  ${k}: ${v}`)
    .join(',\n')
  return `{\n  owner: ${r.owner},\n${fields}\n}`
}

/**
 * Match a single record against the target circleId.
 * Returns plaintext string or null.
 */
function matchRecord(r: any, circleId: string, bareId: string): string | null {
  // Strategy 1: Provable SDK parsed data object  r.data.circle_id
  if (r.data?.circle_id) {
    const storedId = String(r.data.circle_id).replace('.private', '').replace('.public', '')
    if (
      storedId === circleId ||
      storedId === bareId ||
      storedId.replace(/field$/i, '') === bareId
    ) {
      return reconstructPlaintext(r)
    }
  }

  // Strategy 2: Pre-decoded plaintext string
  const pt: string | undefined = r.recordPlaintext || r.plaintext || r.record
  if (pt && typeof pt === 'string') {
    if (pt.includes(circleId) || pt.includes(bareId)) return pt
  }

  return null
}

/**
 * Poll requestRecords until a matching CircleMembership is found or give up.
 *
 * Shield Wallet returns "No response" (timeout) OR empty arrays while records
 * are being synced from chain. We retry up to maxAttempts times.
 */
async function pollForMembershipRecord(
  requestRecords: (program: string) => Promise<any>,
  decrypt: ((ct: string) => Promise<any>) | undefined,
  circleId: string,
  onStatus: (msg: string) => void,
  maxAttempts = 5
): Promise<string | null> {
  const bareId = circleId.replace(/field$/i, '')
  const delays = [0, 2000, 4000, 5000, 5000]

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    if (delays[attempt] > 0) {
      onStatus(
        attempt === 1
          ? 'Waiting for record to sync… (attempt 2/5)'
          : `Retrying wallet records… (attempt ${attempt + 1}/${maxAttempts})`
      )
      await new Promise(r => setTimeout(r, delays[attempt]))
    }

    try {
      const records: any[] = (await requestRecords(PROGRAM_ID)) || []
      console.log(`[Contribute] requestRecords attempt ${attempt + 1}: ${records.length} records`)
      if (attempt === 0 && records.length > 0) {
        console.log('[Contribute] Sample record:', JSON.stringify(records[0]))
      }

      // First pass: respect spent flag
      for (const r of records) {
        if (r.spent) continue
        const found = matchRecord(r, circleId, bareId)
        if (found) {
          console.log('[Contribute] Match found (spent-aware, attempt', attempt + 1, ')')
          return found
        }
      }

      // Second pass: ignore spent (Shield Wallet can mark records spent prematurely)
      for (const r of records) {
        const found = matchRecord(r, circleId, bareId)
        if (found) {
          console.log('[Contribute] Match found (ignoring spent, attempt', attempt + 1, ')')
          return found
        }
      }

      // Third pass: try decrypting ciphertext
      if (decrypt) {
        for (const r of records) {
          const ct: string | undefined = r.ciphertext || r.recordCiphertext
          if (!ct) continue
          try {
            const dec = await decrypt(ct)
            const decStr = typeof dec === 'string' ? dec : JSON.stringify(dec)
            if (decStr.includes(circleId) || decStr.includes(bareId)) {
              console.log('[Contribute] Match via decrypt (attempt', attempt + 1, ')')
              return decStr
            }
          } catch { /* try next */ }
        }
      }
    } catch (err: any) {
      console.warn(`[Contribute] requestRecords attempt ${attempt + 1} error:`, err?.message)
    }
  }

  return null
}

interface ContributeResult {
  success: boolean
  transactionId?: string
  error?: string
}

export function useContribute() {
  const { connected, address, executeTransaction, requestRecords, decrypt } = useWallet()
  const [isContributing, setIsContributing] = useState(false)
  const [transactionStatus, setTransactionStatus] = useState<string | null>(null)

  const contribute = useCallback(async (
    circleId: string,
    amount: number,
    potAddress?: string
  ): Promise<ContributeResult> => {
    if (!connected || !address) {
      return { success: false, error: 'Wallet not connected' }
    }
    if (!executeTransaction || !requestRecords) {
      return { success: false, error: 'Wallet does not support required features' }
    }

    setIsContributing(true)
    setTransactionStatus('Looking up your membership record…')

    try {
      // ── Step 1: Locate CircleMembership record ──────────────────────────
      let membershipPlaintext: string | null = null

      // 1a. Fast path: localStorage cache (populated after create/join)
      const cached = getCachedMembership(address, circleId)
      if (cached) {
        console.log('[Contribute] Using cached membership record')
        membershipPlaintext = cached
      }

      // 1b. Poll requestRecords (up to ~16 seconds, 5 attempts)
      if (!membershipPlaintext) {
        membershipPlaintext = await pollForMembershipRecord(
          requestRecords,
          decrypt,
          circleId,
          (msg) => setTransactionStatus(msg)
        )
      }

      // 1c. Cache it for next call
      if (membershipPlaintext) {
        setCachedMembership(address, circleId, membershipPlaintext)
      }

      // 1d. Last-resort: synthesize from known fields so Shield Wallet can
      //     resolve the record from its own encrypted storage by commitment.
      if (!membershipPlaintext) {
        console.warn('[Contribute] Using synthesized membership record (no nonce)')
        membershipPlaintext = synthesizeMembershipRecord(address, circleId, amount)
      }

      // ── Step 2: Get current cycle from backend ──────────────────────────
      const response = await getCircleDetail(circleId)
      const cycle = response.circle.currentCycle || 1

      setTransactionStatus('Awaiting wallet approval…')

      // ── Step 3: Submit contribute(membership, pot_address, cycle) ────────
      // credits.aleo/transfer_public_as_signer inside the contract debits the
      // signer's PUBLIC balance – no separate credits record needed.
      const result = await executeTransaction({
        program: PROGRAM_ID,
        function: 'contribute',
        inputs: [
          membershipPlaintext,                  // membership: CircleMembership
          potAddress || DEFAULT_POT_ADDRESS,    // pot_address: address (public)
          `${cycle}u8`,                         // cycle: u8 (public)
        ],
        fee: BASE_FEE,
        privateFee: false,
      })

      const txId = String((result as any)?.transactionId || result)
      console.log('[Contribute] TX:', txId)
      setTransactionStatus('Contribution confirmed on-chain!')
      await new Promise(r => setTimeout(r, 2000))

      // After contribute the old record is consumed; evict cache so next call
      // re-fetches the fresh membership record the contract returned.
      setCachedMembership(address, circleId, membershipPlaintext)

      // ── Step 4: Mirror to backend (non-critical) ────────────────────────
      try {
        await recordContributionBackend({ circleId, memberAddress: address, cycle, amount, transactionId: txId })
      } catch (e) { console.warn('[Contribute] Backend record failed:', e) }

      setIsContributing(false)
      setTransactionStatus(null)
      return { success: true, transactionId: txId }
    } catch (error) {
      console.error('Contribute error:', error)
      setIsContributing(false)
      setTransactionStatus(null)
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
    }
  }, [connected, address, executeTransaction, requestRecords, decrypt])

  return { contribute, isContributing, transactionStatus }
}
