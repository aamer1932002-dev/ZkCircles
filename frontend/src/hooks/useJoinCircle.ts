import { useState, useCallback } from 'react'
import { useWallet } from '@provablehq/aleo-wallet-adaptor-react'
import { updateCircleMembershipBackend } from '../services/api'
import { setCachedMembership, setJoinTxId } from '../utils/membershipCache'
import { isCircleMatch, extractRecordInput } from '../utils/recordResolver'
import { queryCircleOnChain } from '../utils/onChainQuery'
import { trackTransaction } from '../utils/transactionTracker'
import { PROGRAM_ID, FEE_JOIN } from '../config'
import { isStalePermissionsError, STALE_PERMISSIONS_USER_MSG, dispatchStalePermissionsEvent } from '../utils/walletErrors'

const BASE_FEE = FEE_JOIN

interface JoinCircleResult {
  success: boolean
  transactionId?: string
  error?: string
}

export function useJoinCircle() {
  const { connected, address, executeTransaction, requestRecords, decrypt, disconnect } = useWallet()
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
      // Pre-flight: verify circle is Forming and has space
      setTransactionStatus('Verifying on-chain circle state…')
      const onChain = await queryCircleOnChain(circleId)
      let amount = contributionAmount
      if (onChain) {
        console.log('[JoinCircle] On-chain CircleInfo:', onChain)
        if (onChain.status !== 0) {
          const names: Record<number, string> = { 0: 'Forming', 1: 'Active', 2: 'Completed', 3: 'Cancelled' }
          throw new Error(`Circle is "${names[onChain.status] || onChain.status}" on-chain. Can only join circles that are Forming.`)
        }
        if (onChain.members_joined >= onChain.max_members) {
          throw new Error(`Circle is full (${onChain.members_joined}/${onChain.max_members}). No spots available.`)
        }
        // Use on-chain contribution amount to avoid mismatch
        amount = onChain.contribution_amount
      }

      const inputs = [
        circleId,              // circle_id: field
        `${amount}u64`,        // contribution_amount: u64
      ]

      setTransactionStatus('Awaiting wallet approval…')

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

      // Track on-chain confirmation
      const confirmation = await trackTransaction(txId, setTransactionStatus)

      if (confirmation.status === 'rejected') {
        setIsJoining(false)
        setTransactionStatus(null)
        return {
          success: false,
          error: `Transaction REJECTED on-chain.\n${confirmation.rejectionReason || 'Finalize failed.'}\nTX: ${txId.slice(0, 24)}…`,
        }
      }

      if (confirmation.status === 'timeout') {
        setIsJoining(false)
        setTransactionStatus(null)
        return {
          success: false,
          error: `Could not confirm on-chain within timeout. TX: ${txId.slice(0, 24)}…\nCheck the Aleo explorer.`,
        }
      }

      // Accepted — cache record & update backend
      setTransactionStatus('Joined circle — confirmed on-chain!')
      if (confirmation.recordOutputs?.length) {
        setCachedMembership(address, circleId, confirmation.recordOutputs[0])
        console.log('[JoinCircle] Membership record cached from TX output')
      } else if (requestRecords) {
        try {
          const records: any[] = (await (requestRecords as any)(PROGRAM_ID, true)) || []
          const bareId = circleId.replace(/field$/i, '')
          for (const r of records) {
            if (!isCircleMatch(r, circleId, bareId)) continue
            const recordInput = await extractRecordInput(r, decrypt)
            if (recordInput) {
              setCachedMembership(address, circleId, recordInput)
              console.log('[JoinCircle] Membership record cached from wallet')
            }
            break
          }
        } catch (e) {
          console.warn('[JoinCircle] Could not pre-cache membership record:', e)
        }
      }

      // Update backend (non-critical, only after on-chain acceptance)
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
      const msg = error instanceof Error ? error.message : 'Unknown error'
      if (isStalePermissionsError(msg)) {
        try { await disconnect?.() } catch { /* ignore */ }
        dispatchStalePermissionsEvent()
        setIsJoining(false)
        setTransactionStatus(null)
        return { success: false, error: STALE_PERMISSIONS_USER_MSG }
      }
      return { success: false, error: msg }
    }
  }, [connected, address, executeTransaction, disconnect])

  return {
    joinCircle,
    isJoining,
    transactionStatus,
  }
}
