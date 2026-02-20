import { useState, useCallback } from 'react'
import { useWallet } from '@provablehq/aleo-wallet-adaptor-react'
import { updateCircleMembershipBackend } from '../services/api'

const PROGRAM_ID = import.meta.env.VITE_PROGRAM_ID || 'zk_circles_v1.aleo'
const BASE_FEE = 1_000_000 // 1 ALEO in microcredits

interface JoinCircleResult {
  success: boolean
  transactionId?: string
  error?: string
}

export function useJoinCircle() {
  const { connected, address, executeTransaction } = useWallet()
  const [isJoining, setIsJoining] = useState(false)
  const [transactionStatus, setTransactionStatus] = useState<string | null>(null)

  const joinCircle = useCallback(async (circleId: string): Promise<JoinCircleResult> => {
    if (!connected || !address) {
      return { success: false, error: 'Wallet not connected' }
    }

    if (!executeTransaction) {
      return { success: false, error: 'Wallet does not support transactions' }
    }

    setIsJoining(true)
    setTransactionStatus('Preparing to join...')

    try {
      // Prepare the transaction - playground_simple.leo join_circle takes only circle_id
      const inputs = [
        circleId,  // circle_id: field
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
      setTransactionStatus('Transaction submitted!')

      // Wait briefly then mark as success
      await new Promise(resolve => setTimeout(resolve, 2000))
      setTransactionStatus('Successfully joined!')

      // Update backend (non-critical)
      try {
        // Generate a random salt for membership verification
        const salt = Math.floor(Math.random() * 1000000000).toString() + 'field'
        await updateCircleMembershipBackend({
          circleId,
          memberAddress: address,
          transactionId: txId,
          salt,
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
