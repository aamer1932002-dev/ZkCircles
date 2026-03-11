import { useState, useCallback } from 'react'
import { useWallet } from '@provablehq/aleo-wallet-adaptor-react'
import { recordContributionBackend, getCircleDetail } from '../services/api'
import {
  getCachedMembership,
  setCachedMembership,
  clearCachedMembership,
  synthesizeMembershipRecord,
} from '../utils/membershipCache'
import { PROGRAM_ID, FEE_CONTRIBUTE } from '../config'
import { isStalePermissionsError, STALE_PERMISSIONS_USER_MSG, dispatchStalePermissionsEvent } from '../utils/walletErrors'

const BASE_FEE = FEE_CONTRIBUTE

/**
 * Rebuild a CircleMembership Leo record plaintext from a WalletAdapterRecord.
 * Fields MUST be in declaration order: owner, circle_id, contribution_amount.
 * Object.entries() order is unreliable, so we build explicitly.
 */
function reconstructMembershipPlaintext(r: any): string {
  const raw: string | undefined = r.recordPlaintext || r.plaintext || r.record
  if (raw && typeof raw === 'string') return raw
  if (!r.data) return ''
  const owner = r.owner ? `${r.owner}.private` : (r.data.owner || '')
  const circleId = r.data.circle_id || ''
  const contribAmt = r.data.contribution_amount || ''
  return `{\n  owner: ${owner},\n  circle_id: ${circleId},\n  contribution_amount: ${contribAmt}\n}`
}

/**
 * Return true only for CircleMembership records.
 * CircleMembership has `contribution_amount` but NOT `cycle`.
 * ContributionReceipt and PayoutReceipt both have `cycle` — reject them.
 */
function isMembershipRecord(r: any, pt?: string): boolean {
  if (r.data) {
    return 'contribution_amount' in r.data && !('cycle' in r.data)
  }
  if (pt) {
    return pt.includes('contribution_amount') && !/(\bcycle\b.*:)/.test(pt)
  }
  return true // unknown structure — allow and let the wallet reject if wrong
}

/**
 * Match a single CircleMembership record against the target circleId.
 * Returns plaintext string or null.
 */
function matchRecord(r: any, circleId: string, bareId: string): string | null {
  // Strategy 1: Provable SDK parsed data object r.data.circle_id
  if (r.data?.circle_id) {
    const storedId = String(r.data.circle_id).replace('.private', '').replace('.public', '')
    if (
      storedId === circleId ||
      storedId === bareId ||
      storedId.replace(/field$/i, '') === bareId
    ) {
      if (!isMembershipRecord(r)) return null // reject ContributionReceipt / PayoutReceipt
      return reconstructMembershipPlaintext(r)
    }
  }

  // Strategy 2: Pre-decoded plaintext string
  const pt: string | undefined = r.recordPlaintext || r.plaintext || r.record
  if (pt && typeof pt === 'string') {
    if (pt.includes(circleId) || pt.includes(bareId)) {
      if (!isMembershipRecord(r, pt)) return null
      return pt
    }
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
      const records: any[] = (await (requestRecords as any)(PROGRAM_ID, true)) || []
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
  const { connected, address, executeTransaction, requestRecords, decrypt, disconnect } = useWallet()
  const [isContributing, setIsContributing] = useState(false)
  const [transactionStatus, setTransactionStatus] = useState<string | null>(null)

  const contribute = useCallback(async (
    circleId: string,
    amount: number
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

      // ── Step 3: Submit contribute(membership, cycle) ─────────────────────
      // The v6 contract sends to self.address (the program itself) — no
      // pot_address parameter needed. credits move: signer → program.
      const result = await executeTransaction({
        program: PROGRAM_ID,
        function: 'contribute',
        inputs: [
          membershipPlaintext,  // membership: CircleMembership
          `${cycle}u8`,         // cycle: u8 (public)
        ],
        fee: BASE_FEE,
        privateFee: false,
      })

      const txId = String((result as any)?.transactionId || result)
      console.log('[Contribute] TX:', txId)
      setTransactionStatus('Contribution confirmed on-chain!')
      await new Promise(r => setTimeout(r, 2000))

      // contribute consumes the old record and issues a fresh one — evict the
      // stale cache so the next call fetches the new record from the wallet.
      clearCachedMembership(address, circleId)

      // ── Step 4: Mirror to backend (non-critical) ────────────────────────
      try {
        await recordContributionBackend({ circleId, memberAddress: address, cycle, amount, transactionId: txId })
      } catch (e) { console.warn('[Contribute] Backend record failed:', e) }

      setIsContributing(false)
      setTransactionStatus(null)
      return { success: true, transactionId: txId }
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error'
      if (isStalePermissionsError(msg)) {
        try { await disconnect?.() } catch { /* ignore */ }
        dispatchStalePermissionsEvent()
        setIsContributing(false)
        setTransactionStatus(null)
        return { success: false, error: STALE_PERMISSIONS_USER_MSG }
      }
      console.error('Contribute error:', error)
      setIsContributing(false)
      setTransactionStatus(null)
      return { success: false, error: msg }
    }
  }, [connected, address, executeTransaction, requestRecords, decrypt, disconnect])

  return { contribute, isContributing, transactionStatus }
}
