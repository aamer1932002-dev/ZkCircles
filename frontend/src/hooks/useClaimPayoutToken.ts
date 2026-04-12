/**
 * useClaimPayoutToken — stablecoin payout claim via direct program imports (v9).
 *
 * Parallels useClaimPayout.ts but dispatches to `claim_payout_usdcx` or `claim_payout_usad`
 * based on the circle's tokenId (1field = USDCx, 2field = USAD).
 * Falls back to the credits `claim_payout` transition for tokenId = 0field.
 *
 * Flow:
 *   1. Resolve CircleMembership record (cache → wallet → chain)
 *   2. Query on-chain circle state for current cycle + payout amount
 *   3. Verify all members have contributed and it's this user's turn
 *   4. executeTransaction → claim_payout_usdcx / claim_payout_usad (membership, cycle, payout_amount)
 *   5. Track confirmation, update caches and backend
 */
import { useState, useCallback } from 'react'
import { useWallet } from '@provablehq/aleo-wallet-adaptor-react'
import { recordPayoutBackend, getCircleDetail } from '../services/api'
import {
  getCachedMembership,
  setCachedMembership,
  clearCachedMembership,
  getJoinTxId,
  setJoinTxId,
  fetchRecordCiphertextFromChain,
  fetchRecordByIndexFromChain,
  decryptAndCacheMembership,
} from '../utils/membershipCache'
import {
  resolveCachedRecord,
  pollForMembershipRecord,
} from '../utils/recordResolver'
import { queryCircleOnChain } from '../utils/onChainQuery'
import { trackTransaction } from '../utils/transactionTracker'
import { PROGRAM_ID, FEE_CLAIM } from '../config'
import {
  isStalePermissionsError,
  STALE_PERMISSIONS_USER_MSG,
  dispatchStalePermissionsEvent,
} from '../utils/walletErrors'

interface ClaimTokenResult {
  success: boolean
  transactionId?: string
  error?: string
}

export function useClaimPayoutToken() {
  const wallet = useWallet() as any
  const { connected, address, executeTransaction, requestRecords, decrypt, disconnect } = wallet
  const walletTxStatus: ((id: string) => Promise<{ status?: string; transactionId?: string }>) | undefined =
    wallet.transactionStatus
  const [isClaiming, setIsClaiming] = useState(false)
  const [transactionStatus, setTransactionStatus] = useState<string | null>(null)

  const claimPayoutToken = useCallback(async (
    circleId: string,
    tokenId: string
  ): Promise<ClaimTokenResult> => {
    if (!connected || !address) return { success: false, error: 'Wallet not connected' }
    if (!executeTransaction || !requestRecords) return { success: false, error: 'Wallet does not support required features' }

    setIsClaiming(true)
    setTransactionStatus('Looking up your membership record…')

    try {
      // ── Step 1: Resolve membership record ────────────────────────────
      let membershipInput: string | null = null

      const cached = getCachedMembership(address, circleId)
      if (cached) {
        const resolved = await resolveCachedRecord(cached, decrypt)
        if (resolved) {
          membershipInput = resolved
          if (resolved !== cached) setCachedMembership(address, circleId, resolved)
        } else {
          clearCachedMembership(address, circleId)
        }
      }

      if (!membershipInput) {
        membershipInput = await pollForMembershipRecord(
          requestRecords as any, decrypt, circleId, setTransactionStatus, 'ClaimPayoutToken'
        )
        if (membershipInput) setCachedMembership(address, circleId, membershipInput)
      }

      if (!membershipInput) {
        const txId = getJoinTxId(address, circleId)
        if (txId) {
          setTransactionStatus('Fetching record from Aleo blockchain…')
          const ciphertext =
            (await fetchRecordByIndexFromChain(txId, PROGRAM_ID, 0)) ||
            (await fetchRecordCiphertextFromChain(txId, PROGRAM_ID))
          if (ciphertext) {
            if (decrypt) {
              membershipInput = await decryptAndCacheMembership(address, circleId, ciphertext, decrypt)
            } else {
              membershipInput = ciphertext
              setCachedMembership(address, circleId, ciphertext)
            }
          }
        }
      }

      if (!membershipInput) {
        throw new Error(
          'Membership record not found in your wallet.\n\n' +
          '• Ensure you joined this circle and the transaction is confirmed.\n' +
          '• Open Shield Wallet and tap "Sync" to force a record refresh, then try again.'
        )
      }

      // ── Step 2: Query on-chain circle state ──────────────────────────
      setTransactionStatus('Verifying on-chain circle state…')
      const onChain = await queryCircleOnChain(circleId)
      const response = await getCircleDetail(circleId)

      let cycleNumber: number
      let payoutAmount: number

      if (onChain) {
        if (onChain.status !== 1) {
          const statusNames: Record<number, string> = { 0: 'Forming', 1: 'Active', 2: 'Completed', 3: 'Cancelled' }
          throw new Error(`Circle is "${statusNames[onChain.status] || onChain.status}" on-chain (not Active). Payouts only claimable when Active.`)
        }
        cycleNumber = onChain.current_cycle
        payoutAmount = onChain.contribution_amount * onChain.max_members
        if (cycleNumber === 0) throw new Error('Circle has not started yet on-chain.')
      } else {
        cycleNumber = Number(response.circle.currentCycle) || 1
        payoutAmount = Number(response.circle.contributionAmount) * Number(response.circle.maxMembers)
      }

      if (payoutAmount <= 0) throw new Error('Could not determine payout amount from circle details.')

      // ── Step 3: Verify all members contributed ───────────────────────
      const maxMembers = onChain?.max_members ?? Number(response.circle.maxMembers) ?? 0
      const contributorsThisCycle = (response.members ?? []).filter(
        m => m.contributedCycles?.includes(cycleNumber)
      ).length
      if (contributorsThisCycle < maxMembers) {
        const remaining = maxMembers - contributorsThisCycle
        throw new Error(
          `Cannot claim yet — not all members have contributed for cycle ${cycleNumber}.\n\n` +
          `${contributorsThisCycle} of ${maxMembers} have contributed. ` +
          `${remaining} still need${remaining === 1 ? 's' : ''} to contribute.`
        )
      }

      const myMember = response.members?.find(m => m.address === address)
      if (myMember && myMember.joinOrder !== cycleNumber) {
        throw new Error(
          `It's not your turn to claim. Your join order is #${myMember.joinOrder}, ` +
          `but the current cycle is ${cycleNumber}.`
        )
      }

      setTransactionStatus('Awaiting wallet approval…')

      // Dispatch to the correct transition based on token_id
      const fnName = tokenId === '1field' ? 'claim_payout_usdcx'
                   : tokenId === '2field' ? 'claim_payout_usad'
                   : 'claim_payout'
      const fmt = membershipInput.startsWith('record1')
        ? 'ciphertext'
        : membershipInput.includes('_nonce') ? 'plaintext+nonce' : 'bare-plaintext'
      console.log(`[ClaimPayoutToken] fn=${fnName}, cycle=${cycleNumber}u8, payout=${payoutAmount}u64, record=[${fmt}]`)

      // ── Step 4: Submit claim_payout_usdcx / claim_payout_usad ──────
      const result = await executeTransaction({
        program: PROGRAM_ID,
        function: fnName,
        inputs: [
          membershipInput,           // membership: CircleMembership
          `${cycleNumber}u8`,        // cycle: u8 (public)
          `${payoutAmount}u64`,      // payout_amount: u64 (public)
        ],
        fee: FEE_CLAIM,
        privateFee: false,
        recordIndices: [0],
      })

      const txId = String((result as any)?.transactionId || result)
      console.log('[ClaimPayoutToken] TX:', txId)

      const confirmation = await trackTransaction(txId, setTransactionStatus, 180_000, 6_000, walletTxStatus)

      if (confirmation.status === 'rejected') {
        setIsClaiming(false)
        setTransactionStatus(null)
        return {
          success: false, transactionId: confirmation.txId,
          error: `Payout REJECTED on-chain.\n${confirmation.rejectionReason || 'Finalize failed.'}\nTX: ${confirmation.txId.slice(0, 24)}…`,
        }
      }
      if (confirmation.status === 'timeout') {
        setIsClaiming(false)
        setTransactionStatus(null)
        return {
          success: false, transactionId: confirmation.txId,
          error: `Could not confirm payout on-chain within timeout. TX: ${confirmation.txId.slice(0, 24)}…`,
        }
      }

      // ── Step 5: Update caches ────────────────────────────────────────
      // claim_payout now returns (CircleMembership, PayoutReceipt, Final)
      // CircleMembership is at record output index 0
      setTransactionStatus('Payout confirmed on-chain!')
      clearCachedMembership(address, circleId)
      setJoinTxId(address, circleId, confirmation.txId)

      // Cache the returned CircleMembership (output[0]) for future contribute/claim
      try {
        let ciphertext: string | null =
          (confirmation.recordOutputs?.length ? confirmation.recordOutputs[0] : null) ?? null
        if (!ciphertext) {
          ciphertext = await fetchRecordByIndexFromChain(confirmation.txId, PROGRAM_ID, 0)
        }
        if (ciphertext) {
          setCachedMembership(address, circleId, ciphertext)
          console.log('[ClaimPayoutToken] Cached new CircleMembership from output[0]')
          if (decrypt) {
            await decryptAndCacheMembership(address, circleId, ciphertext, decrypt)
            console.log('[ClaimPayoutToken] Upgraded to decrypted plaintext')
          }
        }
      } catch (e) {
        console.warn('[ClaimPayoutToken] Cache update failed (non-critical):', e)
      }

      try {
        await recordPayoutBackend({ circleId, memberAddress: address, cycle: cycleNumber, amount: payoutAmount, transactionId: confirmation.txId })
      } catch (e) { console.warn('[ClaimPayoutToken] backend failed:', e) }

      setIsClaiming(false)
      setTransactionStatus(null)
      return { success: true, transactionId: txId }
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error'
      if (isStalePermissionsError(msg)) {
        try { await disconnect?.() } catch { /* ignore */ }
        dispatchStalePermissionsEvent()
        setIsClaiming(false)
        setTransactionStatus(null)
        return { success: false, error: STALE_PERMISSIONS_USER_MSG }
      }
      console.error('[ClaimPayoutToken] error:', error)
      setIsClaiming(false)
      setTransactionStatus(null)
      return { success: false, error: msg }
    }
  }, [connected, address, executeTransaction, requestRecords, decrypt, disconnect])

  return { claimPayoutToken, isClaiming, transactionStatus }
}
