import { useState, useCallback } from 'react'
import { useWallet } from '@provablehq/aleo-wallet-adaptor-react'
import { recordPayoutBackend, getCircleDetail } from '../services/api'
import {
  getCachedMembership,
  setCachedMembership,
  clearCachedMembership,
  getJoinTxId,
  fetchRecordCiphertextFromChain,
} from '../utils/membershipCache'
import {
  resolveCachedRecord,
  pollForMembershipRecord,
} from '../utils/recordResolver'
import { PROGRAM_ID, FEE_CLAIM } from '../config'
import { isStalePermissionsError, STALE_PERMISSIONS_USER_MSG, dispatchStalePermissionsEvent } from '../utils/walletErrors'

const BASE_FEE = FEE_CLAIM

interface ClaimResult {
  success: boolean
  transactionId?: string
  error?: string
}

export function useClaimPayout() {
  const { connected, address, executeTransaction, requestRecords, decrypt, disconnect } = useWallet()
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
      if (!membershipInput) {
        const txId = getJoinTxId(address, circleId)
        if (txId) {
          setTransactionStatus('Fetching record from Aleo testnet…')
          console.log('[ClaimPayout] querying testnet for txId:', txId)
          const ciphertext = await fetchRecordCiphertextFromChain(txId, PROGRAM_ID)
          if (ciphertext && ciphertext.startsWith('record1')) {
            const resolved = await resolveCachedRecord(ciphertext, decrypt)
            if (resolved) {
              console.log('[ClaimPayout] using chain record (decrypted:', resolved !== ciphertext, ')')
              membershipInput = resolved
              setCachedMembership(address, circleId, resolved)
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

      // ── Get current cycle + circle info (needed for payout amount) ────────
      const response = await getCircleDetail(circleId)
      const cycleNumber = Number(response.circle.currentCycle) || 1
      // payout = every member's contribution for one cycle
      const contributionAmount = Number(response.circle.contributionAmount) || 0
      const maxMembers = Number(response.circle.maxMembers) || 0
      const payoutAmount = contributionAmount * maxMembers
      if (payoutAmount <= 0) {
        throw new Error('Could not determine payout amount from circle details.')
      }

      setTransactionStatus('Awaiting wallet approval…')

      const fmt = membershipInput.startsWith('record1')
        ? 'ciphertext'
        : membershipInput.includes('_nonce') ? 'plaintext+nonce' : 'bare-plaintext'
      console.log(`[ClaimPayout] executeTransaction input[0] format: ${fmt}, length: ${membershipInput.length}`)
      console.log('[ClaimPayout] input[0] first 120 chars:', membershipInput.slice(0, 120))

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
      setTransactionStatus('Payout claimed!')
      await new Promise(r => setTimeout(r, 2000))

      // Membership is consumed by claim_payout — evict the stale cache
      clearCachedMembership(address, circleId)

      try {
        await recordPayoutBackend({ circleId, memberAddress: address, cycle: cycleNumber, amount: 0, transactionId: txId })
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
      console.error('ClaimPayout error:', error)
      setIsClaiming(false)
      setTransactionStatus(null)
      return { success: false, error: msg }
    }
  }, [connected, address, executeTransaction, requestRecords, decrypt])

  return { claimPayout, isClaiming, transactionStatus }
}
