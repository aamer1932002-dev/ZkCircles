import { useState, useCallback } from 'react'
import { useWallet } from '@provablehq/aleo-wallet-adaptor-react'
import { recordPayoutBackend, getCircleDetail } from '../services/api'
import {
  getCachedMembership,
  setCachedMembership,
  clearCachedMembership,
  getJoinTxId,
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
import { isStalePermissionsError, STALE_PERMISSIONS_USER_MSG, dispatchStalePermissionsEvent, isRecordNotFoundError, RECORD_NOT_FOUND_USER_MSG } from '../utils/walletErrors'

const BASE_FEE = FEE_CLAIM

interface ClaimResult {
  success: boolean
  transactionId?: string
  error?: string
}

export function useClaimPayout() {
  const wallet = useWallet() as any
  const { connected, address, executeTransaction, requestRecords, decrypt, disconnect } = wallet
  // Shield Wallet returns a temp 'shield_…' ID from executeTransaction().
  // walletTxStatus() lets trackTransaction() resolve it to the real at1… on-chain ID.
  const walletTxStatus: ((id: string) => Promise<{ status?: string; transactionId?: string }>) | undefined =
    wallet.transactionStatus
  const [isClaiming, setIsClaiming] = useState(false)
  const [transactionStatus, setTransactionStatus] = useState<string | null>(null)

  const claimPayout = useCallback(async (
    circleId: string
  ): Promise<ClaimResult> => {
    if (!connected || !address) return { success: false, error: 'Wallet not connected' }
    if (!executeTransaction || !requestRecords) return { success: false, error: 'Wallet does not support required features' }

    setIsClaiming(true)
    setTransactionStatus('Looking up your membership record…')

    try {
      let membershipInput: string | null = null

      // ── Layer 1: cache ── resolveCachedRecord decrypts ciphertext
      const cached = getCachedMembership(address, circleId)
      if (cached) {
        const resolved = await resolveCachedRecord(cached, decrypt)
        if (resolved) {
          console.log('[ClaimPayout] cache hit')
          membershipInput = resolved
          if (resolved !== cached) setCachedMembership(address, circleId, resolved)
        } else {
          console.warn('[ClaimPayout] Cached record unusable — clearing')
          clearCachedMembership(address, circleId)
        }
      }

      // ── Layer 2: poll wallet ── extractRecordInput decrypts each match
      if (!membershipInput && requestRecords) {
        membershipInput = await pollForMembershipRecord(
          requestRecords as any,
          decrypt,
          circleId,
          setTransactionStatus,
          'ClaimPayout'
        )
        if (membershipInput) setCachedMembership(address, circleId, membershipInput)
      }

      // ── Layer 3: fetch raw ciphertext from Aleo testnet → decrypt it
      // For join/create TX: CircleMembership is record output [0]
      // For contribute TX: CircleMembership is also record output [0] (receipts are [1]+)
      if (!membershipInput) {
        const txId = getJoinTxId(address, circleId)
        if (txId) {
          setTransactionStatus('Fetching record from Aleo blockchain…')
          console.log('[ClaimPayout] querying chain for txId:', txId)
          // Try index-specific fetch first (CircleMembership is always output[0])
          const ciphertext =
            (await fetchRecordByIndexFromChain(txId, PROGRAM_ID, 0)) ||
            (await fetchRecordCiphertextFromChain(txId, PROGRAM_ID))
          if (ciphertext) {
            if (decrypt) {
              membershipInput = await decryptAndCacheMembership(address, circleId, ciphertext, decrypt)
              console.log('[ClaimPayout] Layer 3 success (decrypted)')
            } else {
              membershipInput = ciphertext
              setCachedMembership(address, circleId, ciphertext)
              console.log('[ClaimPayout] Layer 3 success (ciphertext)')
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

      // ── Pre-flight: query on-chain circles mapping for true state ──────
      setTransactionStatus('Verifying on-chain circle state…')
      const onChain = await queryCircleOnChain(circleId)
      const response = await getCircleDetail(circleId)

      let cycleNumber: number
      let payoutAmount: number

      if (onChain) {
        console.log('[ClaimPayout] On-chain CircleInfo:', onChain)

        // Validate circle is active
        if (onChain.status !== 1) {
          const statusNames: Record<number, string> = { 0: 'Forming', 1: 'Active', 2: 'Completed', 3: 'Cancelled' }
          throw new Error(
            `Circle is "${statusNames[onChain.status] || onChain.status}" on-chain (not Active). ` +
            'Payouts can only be claimed when the circle is Active.'
          )
        }

        cycleNumber = onChain.current_cycle
        payoutAmount = onChain.contribution_amount * onChain.max_members

        if (cycleNumber === 0) {
          throw new Error('Circle has not started yet on-chain (current_cycle = 0). Ensure all members have joined.')
        }

        console.log(`[ClaimPayout] On-chain: cycle=${cycleNumber}, payout=${payoutAmount} (${onChain.contribution_amount} × ${onChain.max_members})`)
      } else {
        // Fallback to backend data
        console.warn('[ClaimPayout] Could not query on-chain state, using backend data')
        cycleNumber = Number(response.circle.currentCycle) || 1
        const contributionAmount = Number(response.circle.contributionAmount) || 0
        const maxMembers = Number(response.circle.maxMembers) || 0
        payoutAmount = contributionAmount * maxMembers
      }

      if (payoutAmount <= 0) {
        throw new Error('Could not determine payout amount from circle details.')
      }

      // ── CRITICAL: Verify all members have contributed before claiming ──
      // The claim_payout transition calls transfer_public from the PROGRAM'S
      // account. If not all members have contributed, the program balance is
      // less than payout_amount and tf.await() WILL FAIL on-chain (REJECTED).
      const maxMembers = onChain?.max_members ?? Number(response.circle.maxMembers) ?? 0
      const contributorsThisCycle = (response.members ?? []).filter(
        m => m.contributedCycles?.includes(cycleNumber)
      ).length
      console.log(`[ClaimPayout] Contributors for cycle ${cycleNumber}: ${contributorsThisCycle}/${maxMembers}`)
      if (contributorsThisCycle < maxMembers) {
        const remaining = maxMembers - contributorsThisCycle
        throw new Error(
          `Cannot claim yet — not all members have contributed for cycle ${cycleNumber}.\n\n` +
          `${contributorsThisCycle} of ${maxMembers} members have contributed. ` +
          `${remaining} still need${remaining === 1 ? 's' : ''} to contribute.\n\n` +
          `The program will not have enough credits until all members contribute.`
        )
      }

      // Check if this user's joinOrder matches the cycle (only that member can claim)
      const myMember = response.members?.find(m => m.address === address)
      if (myMember) {
        console.log(`[ClaimPayout] My joinOrder=${myMember.joinOrder}, currentCycle=${cycleNumber}`)
        if (myMember.joinOrder !== cycleNumber) {
          throw new Error(
            `It's not your turn to claim. Your join order is #${myMember.joinOrder}, ` +
            `but the current cycle is ${cycleNumber}. ` +
            `Only member #${cycleNumber} can claim this cycle's payout.`
          )
        }
      }

      setTransactionStatus('Awaiting wallet approval…')

      const fmt = membershipInput.startsWith('record1')
        ? 'ciphertext'
        : membershipInput.includes('_nonce') ? 'plaintext+nonce' : 'bare-plaintext'
      console.log(`[ClaimPayout] executeTransaction: cycle=${cycleNumber}u8, payout=${payoutAmount}u64, record=[${fmt}]`)

      const result = await executeTransaction({
        program: PROGRAM_ID,
        function: 'claim_payout',
        inputs: [
          membershipInput,          // membership: CircleMembership
          `${cycleNumber}u8`,       // cycle: u8 (public)
          `${payoutAmount}u64`,     // payout_amount: u64 (public) — verified on-chain
        ],
        fee: BASE_FEE,
        privateFee: false,
        recordIndices: [0],         // Tell wallet that inputs[0] is a record
      })

      const txId = String((result as any)?.transactionId || result)
      console.log('[ClaimPayout] TX:', txId)

      // Track on-chain confirmation (resolves shield_ temp IDs to real at1… IDs)
      const confirmation = await trackTransaction(txId, setTransactionStatus, 180_000, 6_000, walletTxStatus)

      if (confirmation.status === 'rejected') {
        setIsClaiming(false)
        setTransactionStatus(null)
        return {
          success: false, transactionId: confirmation.txId,
          error: `Payout REJECTED on-chain.\n${confirmation.rejectionReason || 'Finalize failed.'}\nTX: ${confirmation.txId.slice(0, 24)}…\nFee was still charged.`,
        }
      }

      if (confirmation.status === 'timeout') {
        setIsClaiming(false)
        setTransactionStatus(null)
        return {
          success: false, transactionId: confirmation.txId,
          error: `Could not confirm payout on-chain within timeout. TX: ${confirmation.txId.slice(0, 24)}…\nCheck the Aleo explorer.`,
        }
      }

      // Accepted — membership is consumed by claim_payout in v11
      setTransactionStatus('Payout confirmed on-chain!')
      clearCachedMembership(address, circleId)

      try {
        await recordPayoutBackend({ circleId, memberAddress: address, cycle: cycleNumber, amount: payoutAmount, transactionId: confirmation.txId })
      } catch (e) { console.warn('[ClaimPayout] backend failed:', e) }

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
      if (isRecordNotFoundError(msg)) {
        setIsClaiming(false)
        setTransactionStatus(null)
        return { success: false, error: RECORD_NOT_FOUND_USER_MSG }
      }
      console.error('ClaimPayout error:', error)
      setIsClaiming(false)
      setTransactionStatus(null)
      return { success: false, error: msg }
    }
  }, [connected, address, executeTransaction, requestRecords, decrypt])

  return { claimPayout, isClaiming, transactionStatus }
}
