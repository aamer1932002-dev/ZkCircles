/**
 * useContributeToken — stablecoin contribution via direct program imports (v9).
 *
 * Parallels useContribute.ts but dispatches to `contribute_usdcx` or `contribute_usad`
 * based on the circle's tokenId (1field = USDCx, 2field = USAD).
 * Falls back to the credits `contribute` transition for tokenId = 0field.
 *
 * Flow:
 *   1. Resolve CircleMembership record (cache → wallet → chain)
 *   2. Query on-chain circle state for current cycle
 *   3. executeTransaction → contribute_usdcx / contribute_usad (membership, cycle)
 *   4. Track confirmation, update cache and backend
 */
import { useState, useCallback } from 'react'
import { useWallet } from '@provablehq/aleo-wallet-adaptor-react'
import { recordContributionBackend, getCircleDetail } from '../services/api'
import {
  getCachedMembership,
  setCachedMembership,
  clearCachedMembership,
  setJoinTxId,
  fetchRecordByIndexFromChain,
  decryptAndCacheMembership,
} from '../utils/membershipCache'
import {
  resolveCachedRecord,
  pollForMembershipRecord,
} from '../utils/recordResolver'
import { queryCircleOnChain } from '../utils/onChainQuery'
import { trackTransaction } from '../utils/transactionTracker'
import { PROGRAM_ID, FEE_CONTRIBUTE } from '../config'
import {
  isStalePermissionsError,
  STALE_PERMISSIONS_USER_MSG,
  dispatchStalePermissionsEvent,
  isRecordNotFoundError,
  RECORD_NOT_FOUND_USER_MSG,
} from '../utils/walletErrors'

interface ContributeTokenResult {
  success: boolean
  transactionId?: string
  error?: string
}

export function useContributeToken() {
  const wallet = useWallet() as any
  const { connected, address, executeTransaction, requestRecords, decrypt, disconnect } = wallet
  const walletTxStatus: ((id: string) => Promise<{ status?: string; transactionId?: string }>) | undefined =
    wallet.transactionStatus
  const [isContributing, setIsContributing] = useState(false)
  const [transactionStatus, setTransactionStatus] = useState<string | null>(null)

  const contributeToken = useCallback(async (
    circleId: string,
    amount: number,
    tokenId: string
  ): Promise<ContributeTokenResult> => {
    if (!connected || !address) return { success: false, error: 'Wallet not connected' }
    if (!executeTransaction || !requestRecords) return { success: false, error: 'Wallet does not support required features' }

    setIsContributing(true)
    setTransactionStatus('Looking up your membership record…')

    try {
      // ── Step 1: Locate CircleMembership record ──────────────────────────
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

      if (!recordInput) {
        recordInput = await pollForMembershipRecord(
          requestRecords as any,
          decrypt,
          circleId,
          (msg) => setTransactionStatus(msg),
          'ContributeToken'
        )
        if (recordInput) setCachedMembership(address, circleId, recordInput)
      }

      if (!recordInput) {
        const { getJoinTxId } = await import('../utils/membershipCache')
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
        setIsContributing(false)
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

      // ── Step 2: Guard against wrong record type in cache ─────────────────
      if (!recordInput.startsWith('record1')) {
        if (/\bcycle\b/.test(recordInput) && !recordInput.includes('contribution_amount')) {
          clearCachedMembership(address, circleId)
          setIsContributing(false)
          setTransactionStatus(null)
          return {
            success: false,
            error:
              'Wrong record type in cache (ContributionReceipt instead of CircleMembership).\n\n' +
              '• Open Shield Wallet → tap the sync/refresh icon\n' +
              '• Wait 30 seconds, then try again',
          }
        }
      }

      // ── Step 3: Get current cycle from on-chain state ─────────────────
      setTransactionStatus('Verifying on-chain circle state…')
      const onChain = await queryCircleOnChain(circleId)
      const response = await getCircleDetail(circleId)
      let cycle: number

      if (onChain) {
        if (onChain.status !== 1) {
          const names: Record<number, string> = { 0: 'Forming', 1: 'Active', 2: 'Completed', 3: 'Cancelled' }
          return { success: false, error: `Circle is "${names[onChain.status] || onChain.status}" on-chain. Contributions only accepted when Active.` }
        }
        cycle = onChain.current_cycle
        if (cycle === 0) return { success: false, error: 'Circle has not started yet on-chain.' }
      } else {
        cycle = response.circle.currentCycle || 1
      }

      setTransactionStatus('Awaiting wallet approval…')

      const fmt = recordInput.startsWith('record1')
        ? 'ciphertext'
        : recordInput.includes('_nonce') ? 'plaintext+nonce' : 'bare-plaintext'
      // Dispatch to the correct transition based on token_id
      const fnName = tokenId === '1field' ? 'contribute_usdcx'
                   : tokenId === '2field' ? 'contribute_usad'
                   : 'contribute'
      console.log(`[ContributeToken] executeTransaction: fn=${fnName}, cycle=${cycle}u8, record=[${fmt}]`)

      // ── Step 4: Submit contribute_usdcx / contribute_usad ──────────
      const result = await executeTransaction({
        program: PROGRAM_ID,
        function: fnName,
        inputs: [
          recordInput,   // membership: CircleMembership
          `${cycle}u8`,  // cycle: u8 (public)
        ],
        fee: FEE_CONTRIBUTE,
        privateFee: false,
        recordIndices: [0],
      })

      const txId = String((result as any)?.transactionId || result)
      console.log('[ContributeToken] TX:', txId)

      // ── Step 5: Track on-chain confirmation ──────────────────────────
      const confirmation = await trackTransaction(txId, setTransactionStatus, 180_000, 6_000, walletTxStatus)

      if (confirmation.status === 'rejected') {
        setIsContributing(false)
        setTransactionStatus(null)
        return {
          success: false, transactionId: txId,
          error: `Transaction REJECTED on-chain.\n${confirmation.rejectionReason || 'Finalize failed.'}\nTX: ${txId.slice(0, 24)}…\nFee was still charged.`,
        }
      }
      if (confirmation.status === 'timeout') {
        setIsContributing(false)
        setTransactionStatus(null)
        return {
          success: false, transactionId: txId,
          error: `Could not confirm on-chain within timeout. TX: ${txId.slice(0, 24)}…\nCheck the Aleo explorer.`,
        }
      }

      // ── Step 6: Update caches ────────────────────────────────────────
      setTransactionStatus('Confirmed on-chain!')
      clearCachedMembership(address, circleId)
      setJoinTxId(address, circleId, confirmation.txId)

      try {
        let ciphertext: string | null =
          (confirmation.recordOutputs?.length ? confirmation.recordOutputs[0] : null) ?? null
        if (!ciphertext) {
          ciphertext = await fetchRecordByIndexFromChain(confirmation.txId, PROGRAM_ID, 0)
        }
        if (ciphertext) {
          setCachedMembership(address, circleId, ciphertext)
          if (decrypt) {
            await decryptAndCacheMembership(address, circleId, ciphertext, decrypt)
          }
        }
      } catch (e) {
        console.warn('[ContributeToken] cache update failed (non-critical):', e)
      }

      try {
        await recordContributionBackend({ circleId, memberAddress: address, cycle, amount, transactionId: txId })
      } catch (e) { console.warn('[ContributeToken] backend record failed:', e) }

      setIsContributing(false)
      setTransactionStatus(null)
      return { success: true, transactionId: txId }
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error'
      if (isStalePermissionsError(msg)) {
        try { await disconnect?.() } catch { /* ignore */ }
        dispatchStalePermissionsEvent()
        setIsContributing(false)
        setTransactionStatus(null)
        return { success: false, error: STALE_PERMISSIONS_USER_MSG }
      }
      if (isRecordNotFoundError(msg)) {
        setIsContributing(false)
        setTransactionStatus(null)
        return { success: false, error: RECORD_NOT_FOUND_USER_MSG }
      }
      console.error('[ContributeToken] error:', error)
      setIsContributing(false)
      setTransactionStatus(null)
      return { success: false, error: msg }
    }
  }, [connected, address, executeTransaction, requestRecords, decrypt, disconnect])

  return { contributeToken, isContributing, transactionStatus }
}
