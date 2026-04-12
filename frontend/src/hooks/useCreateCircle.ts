import { useState, useCallback } from 'react'
import { useWallet } from '@provablehq/aleo-wallet-adaptor-react'
import { generateSalt, hashToField } from '../utils/aleo-utils'
import { saveCircleToBackend } from '../services/api'
import { setCachedMembership, setJoinTxId, decryptAndCacheMembership } from '../utils/membershipCache'
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
  tokenId?: string   // 0field = Aleo credits (default); non-zero = ARC-20 token_id
  minReputation?: number // 0-100, minimum credit score to join (default: 0 = no gate)
}

interface CreateCircleResult {
  success: boolean
  circleId?: string
  transactionId?: string
  error?: string
}

export function useCreateCircle() {
  const wallet = useWallet() as any
  const { connected, address, executeTransaction, requestRecords, decrypt, disconnect } = wallet
  // Shield Wallet returns a temp 'shield_…' ID from executeTransaction().
  // walletTxStatus() lets trackTransaction() resolve it to the real at1… on-chain ID.
  const walletTxStatus: ((id: string) => Promise<{ status?: string; transactionId?: string }>) | undefined =
    wallet.transactionStatus
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

      // Inputs: create_circle(circle_id, contribution_amount, max_members, total_cycles, token_id, min_reputation)
      const tokenId = params.tokenId ?? '0field'
      const minRep = params.minReputation ?? 0
      const inputs = [
        circleId,                                   // circle_id: field
        `${params.contributionAmount}u64`,          // contribution_amount: u64
        `${params.maxMembers}u8`,                   // max_members: u8
        `${params.totalCycles}u8`,                  // total_cycles: u8
        tokenId,                                    // token_id: field (0field = Aleo credits)
        `${minRep}u8`,                              // min_reputation: u8 (0 = no gate)
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

      // Track on-chain confirmation (resolves shield_ temp IDs to real at1… IDs)
      const confirmation = await trackTransaction(txId, setTransactionStatus, 180_000, 6_000, walletTxStatus)
      // Store the real on-chain ID so Layer 3 can locate the membership record
      setJoinTxId(address, circleId, confirmation.txId)

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

      // Accepted — cache record from TX outputs.
      // Immediately decrypt the ciphertext so the first contribution works
      // WITHOUT waiting for the wallet to index the new record.
      setTransactionStatus('Circle created on-chain!')
      if (confirmation.recordOutputs?.length && decrypt) {
        await decryptAndCacheMembership(address, circleId, confirmation.recordOutputs[0], decrypt)
        console.log('[CreateCircle] Membership plaintext cached from TX output')
      } else if (confirmation.recordOutputs?.length) {
        setCachedMembership(address, circleId, confirmation.recordOutputs[0])        
        console.log('[CreateCircle] Membership ciphertext cached from TX output')
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
          tokenId: params.tokenId ?? '0field',
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

