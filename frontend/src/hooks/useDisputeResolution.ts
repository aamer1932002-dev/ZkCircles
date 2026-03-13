import { useState, useCallback } from 'react'
import { useWallet } from '@provablehq/aleo-wallet-adaptor-react'
import { PROGRAM_ID, FEE_DISPUTE } from '../config'
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

interface DisputeResult {
  success: boolean
  transactionId?: string
  error?: string
}

/**
 * useDisputeResolution — flag missed contributions on-chain (v10).
 *
 * Resolves the caller's CircleMembership record from cache → wallet → chain,
 * then calls flag_missed_contribution(membership, defaulter, cycle).
 * The on-chain finalize verifies the defaulter genuinely missed that cycle
 * and increments their cumulative default count.
 */
export function useDisputeResolution() {
  const wallet = useWallet() as any
  const { connected, address, executeTransaction, requestRecords, decrypt, disconnect } = wallet
  const [isFlagging, setIsFlagging] = useState(false)
  const [transactionStatus, setTransactionStatus] = useState<string | null>(null)

  const flagMissedContribution = useCallback(async (
    circleId: string,
    defaulterAddress: string,
    cycle: number,
  ): Promise<DisputeResult> => {
    if (!connected || !address) return { success: false, error: 'Wallet not connected' }
    if (!executeTransaction) return { success: false, error: 'Wallet does not support transactions' }
    if (address === defaulterAddress) return { success: false, error: 'You cannot flag yourself' }

    setIsFlagging(true)
    setTransactionStatus('Looking up your membership record…')

    try {
      // ── Step 1: Resolve CircleMembership record ──────────────────────
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
          (msg) => setTransactionStatus(msg),
          'DisputeResolution'
        )
        if (recordInput) setCachedMembership(address, circleId, recordInput)
      }

      if (!recordInput) {
        const txId = getJoinTxId(address, circleId)
        if (txId) {
          setTransactionStatus('Fetching record from Aleo blockchain…')
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

      if (!recordInput) {
        setIsFlagging(false)
        setTransactionStatus(null)
        return {
          success: false,
          error:
            'Membership record not found.\n\n' +
            'Your wallet may not have synced the record yet.\n\n' +
            '• Open Shield Wallet → tap the sync/refresh icon\n' +
            '• Wait 30–60 seconds, then try again',
        }
      }

      // ── Step 2: Submit flag_missed_contribution ─────────────────────
      setTransactionStatus('Submitting dispute on-chain…')

      const result = await executeTransaction({
        program: PROGRAM_ID,
        function: 'flag_missed_contribution',
        inputs: [recordInput, defaulterAddress, `${cycle}u8`],
        fee: FEE_DISPUTE,
        privateFee: false,
        recordIndices: [0],
      })

      const txId = String((result as any)?.transactionId || result)
      console.log('[DisputeResolution] TX:', txId)
      setTransactionStatus('Missed payment flagged on-chain!')
      await new Promise(r => setTimeout(r, 1500))
      setIsFlagging(false)
      setTransactionStatus(null)
      return { success: true, transactionId: txId }
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error'
      if (isStalePermissionsError(msg)) {
        try { await disconnect?.() } catch { /* ignore */ }
        dispatchStalePermissionsEvent()
        setIsFlagging(false)
        setTransactionStatus(null)
        return { success: false, error: STALE_PERMISSIONS_USER_MSG }
      }
      console.error('[DisputeResolution] Error:', error)
      setIsFlagging(false)
      setTransactionStatus(null)
      return { success: false, error: msg }
    }
  }, [connected, address, executeTransaction, requestRecords, decrypt, disconnect])

  return { flagMissedContribution, isFlagging, transactionStatus }
}
