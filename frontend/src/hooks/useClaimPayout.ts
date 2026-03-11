import { useState, useCallback } from 'react'
import { useWallet } from '@provablehq/aleo-wallet-adaptor-react'
import { recordPayoutBackend, getCircleDetail } from '../services/api'

const PROGRAM_ID = import.meta.env.VITE_PROGRAM_ID || 'zk_circles_v5.aleo'
const BASE_FEE = 1_000_000 // 1 ALEO in microcredits

/**
 * Reconstruct a record plaintext string from a WalletAdapterRecord.
 * The Provable SDK returns parsed fields in `r.data` rather than a raw
 * plaintext string, so we rebuild the string the Leo VM expects.
 */
function reconstructPlaintext(r: any): string {
  // If the SDK already gives us a plaintext string, use it directly.
  const raw: string | undefined = r.recordPlaintext || r.plaintext || r.record
  if (raw && typeof raw === 'string') return raw

  // Otherwise, rebuild from the parsed data object.
  if (!r.data) return ''
  const fields = Object.entries(r.data as Record<string, string>)
    .map(([k, v]) => `  ${k}: ${v}`)
    .join(',\n')
  return `{\n  owner: ${r.owner},\n${fields}\n}`
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
    setTransactionStatus('Verifying your turn...')

    try {
      // Get circle details to verify it's the user's turn
      const response = await getCircleDetail(circleId)
      const circle = response.circle

      // Don't block on local status — the Aleo contract enforces validity on-chain.
      // Local status may be stale (e.g. 0/Forming) even when the circle is active.
      const cycleNumber = circle.currentCycle || 1
      const payoutAmount = circle.contributionAmount * circle.maxMembers

      setTransactionStatus('Fetching your membership record...')

      // Find membership record for this circle
      let membershipPlaintext: string | null = null
      try {
        const programRecords = await requestRecords(PROGRAM_ID) || []
        console.log('[ClaimPayout] Program records count:', (programRecords as any[]).length)
        if ((programRecords as any[]).length > 0) {
          console.log('[ClaimPayout] First record shape:', JSON.stringify((programRecords as any[])[0]))
        }

        // Strip the "field" type suffix so we can compare bare numbers too
        const bareCircleId = circleId.replace(/field$/i, '')

        for (const r of programRecords as any[]) {
          if (r.spent) continue

          // ── Strategy 1: SDK returns parsed `data` object (Provable SDK standard) ──
          // r.data = { circle_id: "123field.private", payout_order: "1u8.private" }
          if (r.data?.circle_id) {
            const storedId = String(r.data.circle_id).replace('.private', '').replace('.public', '')
            if (storedId === circleId || storedId === bareCircleId || storedId.replace(/field$/i, '') === bareCircleId) {
              membershipPlaintext = reconstructPlaintext(r)
              console.log('[ClaimPayout] Matched via r.data.circle_id')
              break
            }
          }

          // ── Strategy 2: Some adapters expose recordPlaintext / plaintext as a string ──
          const pt: string | undefined = r.recordPlaintext || r.plaintext || r.record
          if (pt && typeof pt === 'string') {
            if (pt.includes(circleId) || pt.includes(bareCircleId)) {
              membershipPlaintext = pt
              console.log('[ClaimPayout] Matched via plaintext string')
              break
            }
          }

          // ── Strategy 3: Encrypted — decrypt then match ──
          const ct: string | undefined = r.ciphertext || r.recordCiphertext
          if (ct && decrypt) {
            try {
              const decPt = await decrypt(ct)
              const decStr = typeof decPt === 'string' ? decPt : JSON.stringify(decPt)
              if (decStr.includes(circleId) || decStr.includes(bareCircleId)) {
                membershipPlaintext = decStr
                console.log('[ClaimPayout] Matched via decrypted ciphertext')
                break
              }
            } catch { /* try next */ }
          }
        }
      } catch (e) {
        console.warn('[ClaimPayout] Failed to fetch program records:', e)
      }

      if (!membershipPlaintext) {
        throw new Error(
          'No membership record found for this circle. ' +
          'Make sure the join transaction is confirmed on-chain and try again.'
        )
      }

      setTransactionStatus('Awaiting wallet approval...')

      // claim_payout(membership: CircleMembership, public cycle: u8)
      const result = await executeTransaction({
        program: PROGRAM_ID,
        function: 'claim_payout',
        inputs: [
          membershipPlaintext,   // membership: CircleMembership
          `${cycleNumber}u8`,    // cycle: u8 (public)
        ],
        fee: BASE_FEE,
        privateFee: false, // CRITICAL: Shield Wallet requires privateFee: false
      })

      const txId = String(result?.transactionId || result)
      console.log('[ClaimPayout] Transaction ID:', txId)

      // Record in backend
      try {
        await recordPayoutBackend({
          circleId,
          memberAddress: address,
          cycle: cycleNumber,
          amount: payoutAmount,
          transactionId: txId,
        })
      } catch (backendError) {
        console.warn('Backend payout record failed:', backendError)
      }

      setTransactionStatus(`Payout of ${(payoutAmount / 1_000_000).toFixed(3)} ALEO claimed!`)
      await new Promise(resolve => setTimeout(resolve, 1500))

      setIsClaiming(false)
      setTransactionStatus(null)

      return {
        success: true,
        transactionId: txId,
        amount: payoutAmount,
      }
    } catch (error) {
      console.error('Claim payout error:', error)
      setIsClaiming(false)
      setTransactionStatus(null)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }, [connected, address, executeTransaction, requestRecords, decrypt])

  return {
    claimPayout,
    isClaiming,
    transactionStatus,
  }
}
