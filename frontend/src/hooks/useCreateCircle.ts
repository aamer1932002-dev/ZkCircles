import { useState, useCallback } from 'react'
import { useWallet } from '@provablehq/aleo-wallet-adaptor-react'
import { generateSalt, hashToField } from '../utils/aleo-utils'
import { saveCircleToBackend } from '../services/api'

const PROGRAM_ID = import.meta.env.VITE_PROGRAM_ID || 'zk_circles_v1.aleo'
const BASE_FEE = 1_000_000 // 1 ALEO in microcredits

interface CreateCircleParams {
  name: string
  contributionAmount: number // in microcredits
  maxMembers: number
  cycleDurationBlocks: number
}

interface CreateCircleResult {
  success: boolean
  circleId?: string
  transactionId?: string
  error?: string
}

export function useCreateCircle() {
  const { connected, address, executeTransaction } = useWallet()
  const [isCreating, setIsCreating] = useState(false)
  const [transactionStatus, setTransactionStatus] = useState<string | null>(null)

  const createCircle = useCallback(async (params: CreateCircleParams): Promise<CreateCircleResult> => {
    if (!connected || !address) {
      return { success: false, error: 'Wallet not connected' }
    }

    if (!executeTransaction) {
      return { success: false, error: 'Wallet does not support transactions' }
    }

    setIsCreating(true)
    setTransactionStatus('Preparing transaction...')

    try {
      // Generate random salt for circle ID
      const salt = generateSalt()
      
      // Hash the circle name for privacy
      const nameHash = await hashToField(params.name)
      
      // Prepare the inputs
      // Note: playground_simple.leo doesn't have cycle_duration_blocks parameter
      const inputs = [
        nameHash,                          // name_hash: field
        `${params.contributionAmount}u64`, // contribution_amount: u64
        `${params.maxMembers}u8`,          // max_members: u8
        salt,                              // salt: field
      ]

      setTransactionStatus('Awaiting wallet approval...')

      console.log('[CreateCircle] Executing transaction with:', {
        address,
        programId: PROGRAM_ID,
        functionName: 'create_circle',
        inputs,
        fee: BASE_FEE
      })

      // Execute transaction using Provable SDK format
      const result = await executeTransaction({
        program: PROGRAM_ID,
        function: 'create_circle',
        inputs,
        fee: BASE_FEE,
        privateFee: false, // CRITICAL: Shield Wallet requires privateFee: false
      })

      const txId = String(result?.transactionId || result)
      console.log('[CreateCircle] Transaction ID:', txId)
      
      setTransactionStatus('Transaction submitted to wallet!')

      // Calculate circle ID (same as contract does)
      const circleId = await hashToField(JSON.stringify({
        creator: address,
        name_hash: nameHash,
        salt: salt
      }))

      // Wait a moment for the wallet to process
      await new Promise(resolve => setTimeout(resolve, 2000))
      setTransactionStatus('Circle created successfully!')

      // Save to backend for indexing
      try {
        await saveCircleToBackend({
          circleId,
          name: params.name,
          nameHash,
          creator: address,
          contributionAmount: params.contributionAmount,
          maxMembers: params.maxMembers,
          cycleDurationBlocks: params.cycleDurationBlocks,
          salt,
          transactionId: txId,
          status: 0, // Active status
        })
      } catch (backendError) {
        console.warn('Backend save failed (non-critical):', backendError)
      }

      setIsCreating(false)
      setTransactionStatus(null)

      return {
        success: true,
        circleId,
        transactionId: txId,
      }
    } catch (error) {
      console.error('[CreateCircle] Error:', error)
      setIsCreating(false)
      setTransactionStatus(null)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }, [connected, address, executeTransaction])

  return {
    createCircle,
    isCreating,
    transactionStatus,
  }
}

