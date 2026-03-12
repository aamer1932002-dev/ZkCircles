import { useState, useCallback } from 'react'
import { useWallet } from '@provablehq/aleo-wallet-adaptor-react'
import { generateSalt, hashToField } from '../utils/aleo-utils'
import { saveCircleToBackend } from '../services/api'
import { setCachedMembership, setJoinTxId } from '../utils/membershipCache'
import { isCircleMatch, extractRecordInput } from '../utils/recordResolver'
import { trackTransaction } from '../utils/transactionTracker'
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
  const { connected, address, executeTransaction, requestRecords, decrypt, disconnect } = useWallet()
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

      // Track on-chain confirmation
      const confirmation = await trackTransaction(txId, setTransactionStatus)

      if (confirmation.status === 'rejected') {
        setIsCreating(false)
        setTransactionStatus(null)
        return {
          success: false,
          error: `Transaction REJECTED on-chain.\n${confirmation.rejectionReason || 'Finalize failed.'}\nTX: ${txId.slice(0, 24)}…`,
        }
      }

      if (confirmation.status === 'timeout') {
        setIsCreating(false)
        setTransactionStatus(null)
        return {
          success: false,
          error: `Could not confirm on-chain within timeout. TX: ${txId.slice(0, 24)}…\nCheck the Aleo explorer.`,
        }
      }

      // Accepted — cache record from TX outputs
      setTransactionStatus('Circle created on-chain!')
      if (confirmation.recordOutputs?.length) {
        setCachedMembership(address, circleId, confirmation.recordOutputs[0])
        console.log('[CreateCircle] Membership record cached from TX output')
      } else if (requestRecords) {
        try {
          const records: any[] = (await (requestRecords as any)(PROGRAM_ID, true)) || []
          const bareId = circleId.replace(/field$/i, '')
          for (const r of records) {
            if (!isCircleMatch(r, circleId, bareId)) continue
            const recordInput = await extractRecordInput(r, decrypt)
            if (recordInput) {
              setCachedMembership(address, circleId, recordInput)
              console.log('[CreateCircle] Membership record cached from wallet')
            }
            break
          }
        } catch (e) {
          console.warn('[CreateCircle] Could not pre-cache membership record:', e)
        }
      }

      // Save to backend for indexing (only after on-chain acceptance)
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

