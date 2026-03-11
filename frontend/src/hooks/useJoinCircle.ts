import { useState, useCallback } from 'react'
import { useWallet } from '@provablehq/aleo-wallet-adaptor-react'
import { updateCircleMembershipBackend } from '../services/api'
import { setCachedMembership, setJoinTxId } from '../utils/membershipCache'
import { PROGRAM_ID, FEE_JOIN } from '../config'

const BASE_FEE = FEE_JOIN

interface JoinCircleResult {
  success: boolean
  transactionId?: string
  error?: string
}

export function useJoinCircle() {
  const { connected, address, executeTransaction, requestRecords } = useWallet()
  const [isJoining, setIsJoining] = useState(false)
  const [transactionStatus, setTransactionStatus] = useState<string | null>(null)

  const joinCircle = useCallback(async (circleId: string, contributionAmount: number): Promise<JoinCircleResult> => {
    if (!connected || !address) {
      return { success: false, error: 'Wallet not connected' }
    }

    if (!executeTransaction) {
      return { success: false, error: 'Wallet does not support transactions' }
    }

    setIsJoining(true)
    setTransactionStatus('Preparing to join...')

    try {
      const inputs = [
        circleId,                    // circle_id: field
        `${contributionAmount}u64`,  // contribution_amount: u64 (verified against config in finalize)
      ]

      setTransactionStatus('Awaiting wallet approval...')

      console.log('[JoinCircle] Executing transaction with:', {
        address,
        programId: PROGRAM_ID,
        functionName: 'join_circle',
        inputs,
        fee: BASE_FEE
      })

      // Execute transaction using Provable SDK format
      const result = await executeTransaction({
        program: PROGRAM_ID,
        function: 'join_circle',
        inputs,
        fee: BASE_FEE,
        privateFee: false, // CRITICAL: Shield Wallet requires privateFee: false
      })

      const txId = String(result?.transactionId || result)
      console.log('[JoinCircle] Transaction ID:', txId)
      setJoinTxId(address, circleId, txId)
      setTransactionStatus('Transaction submitted!')

      // Wait briefly then mark as success
      await new Promise(resolve => setTimeout(resolve, 2000))
      setTransactionStatus('Successfully joined!')

      // Attempt to pre-cache the CircleMembership record
      if (requestRecords) {
        try {
          const records: any[] = (await (requestRecords as any)(PROGRAM_ID, true)) || []
          const bareId = circleId.replace(/field$/i, '')
          for (const r of records) {
            const ciId = r.data?.circle_id
              ? String(r.data.circle_id).replace('.private', '').replace('.public', '')
              : ''
            const pt: string | undefined = r.recordPlaintext || r.plaintext || r.record
            if (
              ciId === circleId || ciId === bareId ||
              (pt && (pt.includes(circleId) || pt.includes(bareId)))
            ) {
              const plaintext = pt || (r.data ? JSON.stringify(r.data) : '')
              if (plaintext) {
                setCachedMembership(address, circleId, plaintext)
                console.log('[JoinCircle] Membership record cached')
              }
              break
            }
          }
        } catch (e) {
          console.warn('[JoinCircle] Could not pre-cache membership record:', e)
        }
      }

      // Update backend (non-critical)
      try {
        await updateCircleMembershipBackend({
          circleId,
          memberAddress: address,
          transactionId: txId,
        })
      } catch (backendError) {
        console.warn('Backend update failed (non-critical):', backendError)
      }

      setIsJoining(false)
      setTransactionStatus(null)

      return {
        success: true,
        transactionId: txId,
      }
    } catch (error) {
      console.error('[JoinCircle] Error:', error)
      setIsJoining(false)
      setTransactionStatus(null)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }, [connected, address, executeTransaction])

  return {
    joinCircle,
    isJoining,
    transactionStatus,
  }
}
