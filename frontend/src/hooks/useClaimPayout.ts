import { useState, useCallback } from 'react'
import { useWallet } from '@provablehq/aleo-wallet-adaptor-react'
import { recordPayoutBackend, getCircleDetail } from '../services/api'

const PROGRAM_ID = import.meta.env.VITE_PROGRAM_ID || 'zk_circles_v5.aleo'
const BASE_FEE = 1_000_000 // 1 ALEO in microcredits

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

      if (circle.status !== 1) {
        throw new Error('Circle is not active')
      }

      const cycleNumber = circle.currentCycle || 1
      const payoutAmount = circle.contributionAmount * circle.maxMembers

      setTransactionStatus('Fetching your membership record...')

      // Find membership record for this circle
      let membershipPlaintext: string | null = null
      try {
        const programRecords = await requestRecords(PROGRAM_ID) || []
        console.log('[ClaimPayout] Program records:', programRecords)

        for (const r of programRecords as any[]) {
          if (r.spent) continue
          const pt = r.recordPlaintext || r.plaintext
          if (pt && pt.includes(circleId)) {
            membershipPlaintext = pt
            break
          }
          // Try decrypt if ciphertext available
          const ct = r.ciphertext || r.recordCiphertext
          if (ct && decrypt) {
            try {
              const decPt = await decrypt(ct)
              if (decPt && typeof decPt === 'string' && decPt.includes(circleId)) {
                membershipPlaintext = decPt
                break
              }
            } catch { /* try next */ }
          }
        }
      } catch (e) {
        console.warn('[ClaimPayout] Failed to fetch program records:', e)
      }

      if (!membershipPlaintext) {
        throw new Error('No membership record found for this circle.')
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
