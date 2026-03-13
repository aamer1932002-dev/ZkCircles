import { useState, useCallback } from 'react'
import { useWallet } from '@provablehq/aleo-wallet-adaptor-react'
import { PROGRAM_ID, FEE_CREATE_DISPUTE, FEE_VOTE_DISPUTE, FEE_RESOLVE_DISPUTE } from '../config'
import {
  getCachedMembership,
  setCachedMembership,
  clearCachedMembership,
  getJoinTxId,
  fetchRecordByIndexFromChain,
  decryptAndCacheMembership,
} from '../utils/membershipCache'
import {
  resolveCachedRecord,
  pollForMembershipRecord,
} from '../utils/recordResolver'
import {
  isStalePermissionsError,
  STALE_PERMISSIONS_USER_MSG,
  dispatchStalePermissionsEvent,
} from '../utils/walletErrors'
import {
  recordDispute,
  recordDisputeVote,
  recordDisputeResolution,
} from '../services/api'

interface DisputeResult {
  success: boolean
  transactionId?: string
  disputeId?: string
  error?: string
}

async function resolveMembership(
  address: string,
  circleId: string,
  requestRecords: any,
  decrypt: any,
  setStatus: (msg: string) => void,
): Promise<string | null> {
  let recordInput: string | null = null

  const cached = getCachedMembership(address, circleId)
  if (cached) {
    const resolved = await resolveCachedRecord(cached, decrypt)
    if (resolved) {
      recordInput = resolved
      if (resolved !== cached) setCachedMembership(address, circleId, resolved)
    } else {
      clearCachedMembership(address, circleId)
    }
  }

  if (!recordInput && requestRecords) {
    recordInput = await pollForMembershipRecord(
      requestRecords as any,
      decrypt,
      circleId,
      setStatus,
      'OnChainDispute'
    )
    if (recordInput) setCachedMembership(address, circleId, recordInput)
  }

  if (!recordInput) {
    const txId = getJoinTxId(address, circleId)
    if (txId) {
      setStatus('Fetching record from Aleo blockchain…')
      const ciphertext = await fetchRecordByIndexFromChain(txId, PROGRAM_ID, 0)
      if (ciphertext) {
        if (decrypt) {
          recordInput = await decryptAndCacheMembership(address, circleId, ciphertext, decrypt)
        } else {
          recordInput = ciphertext
          setCachedMembership(address, circleId, ciphertext)
        }
      }
    }
  }

  return recordInput
}

export function useOnChainDispute() {
  const wallet = useWallet() as any
  const { connected, address, executeTransaction, requestRecords, decrypt, disconnect } = wallet
  const [isProcessing, setIsProcessing] = useState(false)
  const [transactionStatus, setTransactionStatus] = useState<string | null>(null)

  const createDispute = useCallback(async (
    circleId: string,
    accused: string,
    reason: number,
    cycle: number,
  ): Promise<DisputeResult> => {
    if (!connected || !address) return { success: false, error: 'Wallet not connected' }
    if (!executeTransaction) return { success: false, error: 'Wallet does not support transactions' }
    if (address === accused) return { success: false, error: 'You cannot dispute yourself' }

    setIsProcessing(true)
    setTransactionStatus('Looking up your membership record…')

    try {
      const recordInput = await resolveMembership(address, circleId, requestRecords, decrypt, setTransactionStatus)
      if (!recordInput) {
        setIsProcessing(false)
        setTransactionStatus(null)
        return { success: false, error: 'Membership record not found. Try syncing your wallet.' }
      }

      setTransactionStatus('Creating dispute on-chain…')

      const result = await executeTransaction({
        program: PROGRAM_ID,
        function: 'create_dispute',
        inputs: [recordInput, accused, `${reason}u8`, `${cycle}u8`],
        fee: FEE_CREATE_DISPUTE,
        privateFee: false,
        recordIndices: [0],
      })

      const txId = String((result as any)?.transactionId || result)

      // Record off-chain
      // Compute dispute_id the same way Leo does: hash(DisputeKey{circle_id, accused, cycle})
      // We approximate it here for backend indexing
      const disputeId = `${circleId}_${accused}_${cycle}`
      await recordDispute({ disputeId, circleId, accused, reporter: address, reason, cycle, transactionId: txId })

      setTransactionStatus('Dispute created!')
      await new Promise(r => setTimeout(r, 1500))
      setIsProcessing(false)
      setTransactionStatus(null)
      return { success: true, transactionId: txId, disputeId }
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error'
      if (isStalePermissionsError(msg)) {
        try { await disconnect?.() } catch {}
        dispatchStalePermissionsEvent()
        setIsProcessing(false)
        setTransactionStatus(null)
        return { success: false, error: STALE_PERMISSIONS_USER_MSG }
      }
      console.error('[OnChainDispute] createDispute error:', error)
      setIsProcessing(false)
      setTransactionStatus(null)
      return { success: false, error: msg }
    }
  }, [connected, address, executeTransaction, requestRecords, decrypt, disconnect])

  const voteOnDispute = useCallback(async (
    circleId: string,
    disputeId: string,
    voteFor: boolean,
  ): Promise<DisputeResult> => {
    if (!connected || !address) return { success: false, error: 'Wallet not connected' }
    if (!executeTransaction) return { success: false, error: 'Wallet does not support transactions' }

    setIsProcessing(true)
    setTransactionStatus('Looking up your membership record…')

    try {
      const recordInput = await resolveMembership(address, circleId, requestRecords, decrypt, setTransactionStatus)
      if (!recordInput) {
        setIsProcessing(false)
        setTransactionStatus(null)
        return { success: false, error: 'Membership record not found. Try syncing your wallet.' }
      }

      setTransactionStatus('Submitting vote on-chain…')

      // dispute_id for on-chain is a field — we need to pass the hash
      // For now, pass the dispute_id as a field literal
      const result = await executeTransaction({
        program: PROGRAM_ID,
        function: 'vote_on_dispute',
        inputs: [recordInput, `${disputeId}field`, `${voteFor}`],
        fee: FEE_VOTE_DISPUTE,
        privateFee: false,
        recordIndices: [0],
      })

      const txId = String((result as any)?.transactionId || result)
      await recordDisputeVote({ disputeId, voter: address, voteFor, transactionId: txId })

      setTransactionStatus('Vote recorded!')
      await new Promise(r => setTimeout(r, 1500))
      setIsProcessing(false)
      setTransactionStatus(null)
      return { success: true, transactionId: txId }
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error'
      if (isStalePermissionsError(msg)) {
        try { await disconnect?.() } catch {}
        dispatchStalePermissionsEvent()
      }
      console.error('[OnChainDispute] voteOnDispute error:', error)
      setIsProcessing(false)
      setTransactionStatus(null)
      return { success: false, error: msg }
    }
  }, [connected, address, executeTransaction, requestRecords, decrypt, disconnect])

  const resolveDispute = useCallback(async (
    circleId: string,
    disputeId: string,
  ): Promise<DisputeResult> => {
    if (!connected || !address) return { success: false, error: 'Wallet not connected' }
    if (!executeTransaction) return { success: false, error: 'Wallet does not support transactions' }

    setIsProcessing(true)
    setTransactionStatus('Looking up your membership record…')

    try {
      const recordInput = await resolveMembership(address, circleId, requestRecords, decrypt, setTransactionStatus)
      if (!recordInput) {
        setIsProcessing(false)
        setTransactionStatus(null)
        return { success: false, error: 'Membership record not found. Try syncing your wallet.' }
      }

      setTransactionStatus('Resolving dispute on-chain…')

      const result = await executeTransaction({
        program: PROGRAM_ID,
        function: 'resolve_dispute',
        inputs: [recordInput, `${disputeId}field`],
        fee: FEE_RESOLVE_DISPUTE,
        privateFee: false,
        recordIndices: [0],
      })

      const txId = String((result as any)?.transactionId || result)

      // Determine result status (we don't know from TX alone, backend will track)
      await recordDisputeResolution({ disputeId, status: 1, transactionId: txId })

      setTransactionStatus('Dispute resolved!')
      await new Promise(r => setTimeout(r, 1500))
      setIsProcessing(false)
      setTransactionStatus(null)
      return { success: true, transactionId: txId }
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error'
      if (isStalePermissionsError(msg)) {
        try { await disconnect?.() } catch {}
        dispatchStalePermissionsEvent()
      }
      console.error('[OnChainDispute] resolveDispute error:', error)
      setIsProcessing(false)
      setTransactionStatus(null)
      return { success: false, error: msg }
    }
  }, [connected, address, executeTransaction, requestRecords, decrypt, disconnect])

  return {
    createDispute,
    voteOnDispute,
    resolveDispute,
    isProcessing,
    transactionStatus,
  }
}
