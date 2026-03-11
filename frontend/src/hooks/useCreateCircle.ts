import { useState, useCallback } from 'react'
import { useWallet } from '@provablehq/aleo-wallet-adaptor-react'
import { generateSalt, hashToField } from '../utils/aleo-utils'
import { saveCircleToBackend } from '../services/api'
import { setCachedMembership, setJoinTxId } from '../utils/membershipCache'
import { PROGRAM_ID, FEE_CREATE } from '../config'
import { isStalePermissionsError, STALE_PERMISSIONS_USER_MSG, dispatchStalePermissionsEvent } from '../utils/walletErrors'

const BASE_FEE = FEE_CREATE

interface CreateCircleParams {
  name: string
  contributionAmount: number // in microcredits
  maxMembers: number
  totalCycles: number
}

interface CreateCircleResult {
  success: boolean
  circleId?: string
  transactionId?: string
  error?: string
}

export function useCreateCircle() {
  const { connected, address, executeTransaction, requestRecords, disconnect } = useWallet()
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
      // Generate a unique circle_id off-chain: hash(creator:name:salt)
      const salt = generateSalt()
      const circleId = await hashToField(`${address}:${params.name}:${salt}`)

      // Inputs: create_circle(circle_id, contribution_amount, max_members, total_cycles)
      const inputs = [
        circleId,                                   // circle_id: field
        `${params.contributionAmount}u64`,          // contribution_amount: u64
        `${params.maxMembers}u8`,                   // max_members: u8
        `${params.totalCycles}u8`,                  // total_cycles: u8
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
      setJoinTxId(address, circleId, txId)
      
      setTransactionStatus('Transaction submitted to wallet!')

      // Circle ID was computed above before the transaction
      // Wait a moment for the wallet to process
      await new Promise(resolve => setTimeout(resolve, 2000))
      setTransactionStatus('Circle created successfully!')

      // Attempt to cache the CircleMembership record so contribute/claim
      // can find it without needing requestRecords to succeed first.
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
                console.log('[CreateCircle] Membership record cached')
              }
              break
            }
          }
        } catch (e) {
          console.warn('[CreateCircle] Could not pre-cache membership record:', e)
        }
      }

      // Save to backend for indexing
      try {
        await saveCircleToBackend({
          circleId,
          name: params.name,
          creator: address,
          contributionAmount: params.contributionAmount,
          maxMembers: params.maxMembers,
          totalCycles: params.totalCycles,
          transactionId: txId,
          status: 0,
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
      const msg = error instanceof Error ? error.message : 'Unknown error'
      if (isStalePermissionsError(msg)) {
        try { await disconnect?.() } catch { /* ignore */ }
        dispatchStalePermissionsEvent()
        setIsCreating(false)
        setTransactionStatus(null)
        return { success: false, error: STALE_PERMISSIONS_USER_MSG }
      }
      return { success: false, error: msg }
    }
  }, [connected, address, executeTransaction, disconnect])

  return {
    createCircle,
    isCreating,
    transactionStatus,
  }
}

