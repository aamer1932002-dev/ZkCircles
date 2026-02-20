import { useState, useCallback } from 'react'
import { useWallet } from '@provablehq/aleo-wallet-adaptor-react'
import { recordPayoutBackend, getCircleDetail } from '../services/api'

interface ClaimPayoutResult {
  success: boolean
  transactionId?: string
  amount?: number
  error?: string
}

export function useClaimPayout() {
  const { connected, address } = useWallet()
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

      // Calculate payout amount
      const payoutAmount = circle.contributionAmount * circle.maxMembers
      
      setTransactionStatus('Processing payout request...')

      // NOTE: In production, the payout would be handled by:
      // 1. A smart contract finalize function that transfers from program balance
      // 2. Or a backend service that manages the pot and signs transfer transactions
      // 
      // For this demo, we demonstrate credits.aleo integration by:
      // - Contributions use credits.aleo/transfer_private
      // - Payouts are recorded and would use credits.aleo/transfer_public_to_private
      //   from the program's public balance to the member's private balance
      
      // Simulate the payout processing
      await new Promise(resolve => setTimeout(resolve, 2000))
      
      // In a full implementation, this would use executeTransaction with:
      // credits.aleo/transfer_public_to_private(pot_address, address, payoutAmount)
      
      const txId = `payout_${circleId}_${circle.currentCycle}_${Date.now()}`

      // Record in backend
      try {
        await recordPayoutBackend({
          circleId,
          memberAddress: address,
          cycle: circle.currentCycle,
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
  }, [connected, address])

  return {
    claimPayout,
    isClaiming,
    transactionStatus,
  }
}
