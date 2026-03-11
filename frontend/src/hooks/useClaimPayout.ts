import { useState, useCallback } from 'react'
import { useWallet } from '@provablehq/aleo-wallet-adaptor-react'
import { recordPayoutBackend, getCircleDetail } from '../services/api'
import {
  getCachedMembership,
  setCachedMembership,
  clearCachedMembership,
  synthesizeMembershipRecord,
} from '../utils/membershipCache'

const PROGRAM_ID = import.meta.env.VITE_PROGRAM_ID || 'zk_circles_v5.aleo'
const BASE_FEE = 1_000_000

/**
 * Rebuild a Leo record plaintext string from a WalletAdapterRecord.
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

function matchRecord(r: any, circleId: string, bareId: string): string | null {
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
  const pt: string | undefined = r.recordPlaintext || r.plaintext || r.record
  if (pt && typeof pt === 'string') {
    if (pt.includes(circleId) || pt.includes(bareId)) return pt
  }
  return null
}

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
      console.log(`[ClaimPayout] requestRecords attempt ${attempt + 1}: ${records.length} records`)
      if (attempt === 0 && records.length > 0) {
        console.log('[ClaimPayout] Sample record:', JSON.stringify(records[0]))
      }

      // First pass: respect spent
      for (const r of records) {
        if (r.spent) continue
        const found = matchRecord(r, circleId, bareId)
        if (found) return found
      }

      // Second pass: ignore spent
      for (const r of records) {
        const found = matchRecord(r, circleId, bareId)
        if (found) return found
      }

      // Third pass: decrypt
      if (decrypt) {
        for (const r of records) {
          const ct: string | undefined = r.ciphertext || r.recordCiphertext
          if (!ct) continue
          try {
            const dec = await decrypt(ct)
            const decStr = typeof dec === 'string' ? dec : JSON.stringify(dec)
            if (decStr.includes(circleId) || decStr.includes(bareId)) return decStr
          } catch { /* try next */ }
        }
      }
    } catch (err: any) {
      console.warn(`[ClaimPayout] requestRecords attempt ${attempt + 1} error:`, err?.message)
    }
  }

  return null
}

interface ClaimPayoutResult {
  success: boolean
  transactionId?: string
  amount?: number
  error?: string
}

export function useClaimPayout() {
  const { connected, address, executeTransaction, requestRecords, decrypt } = useWallet()
  const [isClaiming, setIsClaiming] = useState(false)
  const [transactionStatus, setTransactionStatus] = useState<string | null>(null)

  const claimPayout = useCallback(async (circleId: string): Promise<ClaimPayoutResult> => {
    if (!connected || !address) {
      return { success: false, error: 'Wallet not connected' }
    }

    setIsClaiming(true)
    setTransactionStatus('Fetching circle details…')

    try {
      // ── Step 1: Get circle details ──────────────────────────────────────
      const response = await getCircleDetail(circleId)
      const circle = response.circle
      const cycleNumber = circle.currentCycle || 1
      const payoutAmount = circle.contributionAmount * circle.maxMembers

      // ── Step 2: Locate CircleMembership record ──────────────────────────
      let membershipPlaintext: string | null = null
      setTransactionStatus('Looking up your membership record…')

      // 2a. Cache
      const cached = getCachedMembership(address, circleId)
      if (cached) {
        console.log('[ClaimPayout] Using cached membership record')
        membershipPlaintext = cached
      }

      // 2b. Poll requestRecords
      if (!membershipPlaintext) {
        membershipPlaintext = await pollForMembershipRecord(
          requestRecords,
          decrypt,
          circleId,
          (msg) => setTransactionStatus(msg)
        )
      }

      // 2c. Cache it
      if (membershipPlaintext) {
        setCachedMembership(address, circleId, membershipPlaintext)
      }

      // 2d. Synthesize as last resort
      if (!membershipPlaintext) {
        console.warn('[ClaimPayout] Using synthesized membership record (no nonce)')
        membershipPlaintext = synthesizeMembershipRecord(address, circleId, circle.contributionAmount)
      }

      setTransactionStatus('Awaiting wallet approval…')

      // ── Step 3: Submit claim_payout(membership, cycle) ──────────────────
      const result = await executeTransaction({
        program: PROGRAM_ID,
        function: 'claim_payout',
        inputs: [
          membershipPlaintext,   // membership: CircleMembership
          `${cycleNumber}u8`,    // cycle: u8 (public)
        ],
        fee: BASE_FEE,
        privateFee: false,
      })

      const txId = String((result as any)?.transactionId || result)
      console.log('[ClaimPayout] TX:', txId)

      // After payout the membership record is consumed and NOT re-issued.
      clearCachedMembership(address, circleId)

      // ── Step 4: Mirror to backend ───────────────────────────────────────
      try {
        await recordPayoutBackend({
          circleId,
          memberAddress: address,
          cycle: cycleNumber,
          amount: payoutAmount,
          transactionId: txId,
        })
      } catch (e) { console.warn('[ClaimPayout] Backend record failed:', e) }

      setTransactionStatus(`Payout of ${(payoutAmount / 1_000_000).toFixed(3)} ALEO claimed!`)
      await new Promise(r => setTimeout(r, 1500))

      setIsClaiming(false)
      setTransactionStatus(null)
      return { success: true, transactionId: txId, amount: payoutAmount }
    } catch (error) {
      console.error('Claim payout error:', error)
      setIsClaiming(false)
      setTransactionStatus(null)
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
    }
  }, [connected, address, executeTransaction, requestRecords, decrypt])

  return { claimPayout, isClaiming, transactionStatus }
}
