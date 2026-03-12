import { useState, useCallback } from 'react'
import { useWallet } from '@provablehq/aleo-wallet-adaptor-react'
import { recordContributionBackend, getCircleDetail } from '../services/api'
import {
  getCachedMembership,
  setCachedMembership,
  clearCachedMembership,
  setJoinTxId,
} from '../utils/membershipCache'
import { PROGRAM_ID, FEE_CONTRIBUTE } from '../config'
import { isStalePermissionsError, STALE_PERMISSIONS_USER_MSG, dispatchStalePermissionsEvent } from '../utils/walletErrors'

const BASE_FEE = FEE_CONTRIBUTE

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
 * Returns a record input string (ciphertext preferred, plaintext fallback) or null.
 *
 * IMPORTANT: never return a hand-built string without _nonce — Shield Wallet
 * rejects it with "Failed to parse input #0".
 */
function matchRecord(r: any, circleId: string, bareId: string): string | null {
  let matched = false

  // Strategy 1: Provable SDK parsed data object r.data.circle_id
  if (r.data?.circle_id) {
    const storedId = String(r.data.circle_id).replace('.private', '').replace('.public', '')
    if (
      storedId === circleId ||
      storedId === bareId ||
      storedId.replace(/field$/i, '') === bareId
    ) {
      if (!isMembershipRecord(r)) return null
      matched = true
    }
  }

  // Strategy 2: Pre-decoded plaintext string
  const pt: string | undefined = r.recordPlaintext || r.plaintext || r.record
  if (!matched && pt && typeof pt === 'string') {
    if (pt.includes(circleId) || pt.includes(bareId)) {
      if (!isMembershipRecord(r, pt)) return null
      matched = true
    }
  }

  if (!matched) return null

  // Prefer ciphertext — Shield Wallet (and most Aleo wallets) decrypt it
  // internally using the user's private key when building the ZK proof.
  // Passing plaintext can fail if it lacks _nonce or is in wrong format.
  const ct: string | undefined = r.ciphertext || r.recordCiphertext
  if (ct && typeof ct === 'string' && ct.startsWith('record1')) return ct

  // Fallback: Leo plaintext that includes _nonce (valid for some paths)
  if (pt && typeof pt === 'string' && pt.includes('_nonce')) return pt

  // Last resort: plaintext without _nonce (likely to fail for Shield)
  if (pt && typeof pt === 'string') return pt

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
        // Log every field key and partial value so we can see the exact shape Shield returns
        console.log('[Contribute] Record keys:', Object.keys(records[0]))
        const r0 = records[0]
        console.log('[Contribute] record[0] fields:', {
          spent: r0.spent,
          owner: r0.owner,
          hasData: !!r0.data,
          dataKeys: r0.data ? Object.keys(r0.data) : [],
          ciphertext: r0.ciphertext ? r0.ciphertext.slice(0, 40) + '...' : 'MISSING',
          recordCiphertext: r0.recordCiphertext ? r0.recordCiphertext.slice(0, 40) + '...' : 'MISSING',
          recordPlaintext: r0.recordPlaintext ? r0.recordPlaintext.slice(0, 80) + '...' : 'MISSING',
          plaintext: r0.plaintext ? r0.plaintext.slice(0, 80) + '...' : 'MISSING',
          record: r0.record ? String(r0.record).slice(0, 80) + '...' : 'MISSING',
        })
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

      // Third pass: decrypt ciphertexts to verify identity, then return ciphertext
      if (decrypt) {
        for (const r of records) {
          const ct: string | undefined = r.ciphertext || r.recordCiphertext
          if (!ct || typeof ct !== 'string' || !ct.startsWith('record1')) continue
          try {
            const dec = await decrypt(ct)
            const decStr = typeof dec === 'string' ? dec : ((dec as any)?.text ?? JSON.stringify(dec))
            console.log('[Contribute] decrypt result type:', typeof dec, 'first 100:', String(decStr).slice(0, 100))
            if (
              (decStr.includes(circleId) || decStr.includes(bareId)) &&
              isMembershipRecord({}, decStr)
            ) {
              console.log('[Contribute] Match via decrypt (attempt', attempt + 1, ')')
              return ct  // return the ciphertext, not the decrypted plaintext
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

      // 1a. Fast path: localStorage cache (populated after create/join).
      //     Accept ciphertext (record1...) OR plaintext that includes _nonce.
      //     Reject bare JSON / plaintext without _nonce — Shield can't parse them.
      const cached = getCachedMembership(address, circleId)
      if (cached && (cached.startsWith('record1') || cached.includes('_nonce'))) {
        console.log('[Contribute] Using cached membership record')
        membershipPlaintext = cached
      } else if (cached) {
        console.warn('[Contribute] Cached record is not a valid ciphertext/plaintext — ignoring, will re-fetch')
        clearCachedMembership(address, circleId)
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

      // 1d. No valid record found — refuse to submit rather than pass a
      //     _nonce-less string that Shield Wallet will reject.
      if (!membershipPlaintext) {
        setIsContributing(false)
        setTransactionStatus(null)
        return {
          success: false,
          error: 'Membership record not found in your wallet. Please wait a moment for the wallet to sync and try again.',
        }
      }

      // ── Step 2: Get current cycle from backend ──────────────────────────
      const response = await getCircleDetail(circleId)
      const cycle = response.circle.currentCycle || 1

      setTransactionStatus('Awaiting wallet approval…')

      // ── Step 3: Submit contribute(membership, cycle) ─────────────────────
      // The v6 contract sends to self.address (the program itself) — no
      // pot_address parameter needed. credits move: signer → program.
      console.log('[Contribute] inputs[0] type:', typeof membershipPlaintext)
      console.log('[Contribute] inputs[0] first 120 chars:', membershipPlaintext!.slice(0, 120))
      console.log('[Contribute] inputs[0] has _nonce:', membershipPlaintext!.includes('_nonce'))
      console.log('[Contribute] inputs[0] starts record1:', membershipPlaintext!.startsWith('record1'))
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
      // Also update the stored TX ID so claimPayout's chain-fetch layer picks
      // up the NEW membership ciphertext from this contribute TX, not the join TX.
      clearCachedMembership(address, circleId)
      setJoinTxId(address, circleId, txId)

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
