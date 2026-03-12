import { useState, useCallback } from 'react'
import { useWallet } from '@provablehq/aleo-wallet-adaptor-react'
import { recordContributionBackend, getCircleDetail } from '../services/api'
import {
  getCachedMembership,
  setCachedMembership,
  clearCachedMembership,
  setJoinTxId,
} from '../utils/membershipCache'
import {
  resolveCachedRecord,
  pollForMembershipRecord,
} from '../utils/recordResolver'
import { PROGRAM_ID, FEE_CONTRIBUTE } from '../config'
import { isStalePermissionsError, STALE_PERMISSIONS_USER_MSG, dispatchStalePermissionsEvent } from '../utils/walletErrors'

const BASE_FEE = FEE_CONTRIBUTE

interface ContributeResult {
  success: boolean
  transactionId?: string
  error?: string
}

export function useContribute() {
  const { connected, address, executeTransaction, requestRecords, decrypt, disconnect } = useWallet()
  const [isContributing, setIsContributing] = useState(false)
  const [transactionStatus, setTransactionStatus] = useState<string | null>(null)

  const contribute = useCallback(async (
    circleId: string,
    amount: number
  ): Promise<ContributeResult> => {
    if (!connected || !address) {
      return { success: false, error: 'Wallet not connected' }
    }
    if (!executeTransaction || !requestRecords) {
      return { success: false, error: 'Wallet does not support required features' }
    }

    setIsContributing(true)
    setTransactionStatus('Looking up your membership record…')

    try {
      // ── Step 1: Locate CircleMembership record ──────────────────────────
      let recordInput: string | null = null

      // 1a. Fast path: localStorage cache.
      //     resolveCachedRecord decrypts ciphertext → proper Aleo plaintext.
      const cached = getCachedMembership(address, circleId)
      if (cached) {
        const resolved = await resolveCachedRecord(cached, decrypt)
        if (resolved) {
          console.log('[Contribute] Using cached record')
          recordInput = resolved
          if (resolved !== cached) setCachedMembership(address, circleId, resolved)
        } else {
          console.warn('[Contribute] Cached record unusable — clearing')
          clearCachedMembership(address, circleId)
        }
      }

      // 1b. Poll requestRecords (up to ~16 seconds, 5 attempts).
      //     For each match, extractRecordInput decrypts ciphertext → plaintext.
      if (!recordInput) {
        recordInput = await pollForMembershipRecord(
          requestRecords as any,
          decrypt,
          circleId,
          (msg) => setTransactionStatus(msg),
          'Contribute'
        )
      }

      // 1c. Cache the resolved input for next call
      if (recordInput) {
        setCachedMembership(address, circleId, recordInput)
      }

      // 1d. No valid record found
      if (!recordInput) {
        setIsContributing(false)
        setTransactionStatus(null)
        return {
          success: false,
          error: 'Membership record not found in your wallet. Please wait a moment for the wallet to sync and try again.',
        }
      }

      // ── Step 2: Get current cycle from backend ──────────────────────────
      const response = await getCircleDetail(circleId)
      const cycle = response.circle.currentCycle || 1

      setTransactionStatus('Awaiting wallet approval…')

      // ── Step 3: Submit contribute(membership, cycle) ─────────────────────
      const fmt = recordInput.startsWith('record1')
        ? 'ciphertext'
        : recordInput.includes('_nonce') ? 'plaintext+nonce' : 'bare-plaintext'
      console.log(`[Contribute] executeTransaction input[0] format: ${fmt}, length: ${recordInput.length}`)
      console.log('[Contribute] input[0] first 120 chars:', recordInput.slice(0, 120))

      const result = await executeTransaction({
        program: PROGRAM_ID,
        function: 'contribute',
        inputs: [
          recordInput,        // membership: CircleMembership.record
          `${cycle}u8`,       // cycle: u8 (public)
        ],
        fee: BASE_FEE,
        privateFee: false,
        recordIndices: [0],   // Tell wallet that inputs[0] is a record
      })

      const txId = String((result as any)?.transactionId || result)
      console.log('[Contribute] TX:', txId)
      setTransactionStatus('Contribution confirmed on-chain!')
      await new Promise(r => setTimeout(r, 2000))

      // contribute consumes the old record and issues a fresh one — evict the
      // stale cache so the next call fetches the new record from the wallet.
      // Also update the stored TX ID so claimPayout's chain-fetch layer picks
      // up the NEW membership ciphertext from this contribute TX, not the join TX.
      clearCachedMembership(address, circleId)
      setJoinTxId(address, circleId, txId)

      // ── Step 4: Mirror to backend (non-critical) ────────────────────────
      try {
        await recordContributionBackend({ circleId, memberAddress: address, cycle, amount, transactionId: txId })
      } catch (e) { console.warn('[Contribute] Backend record failed:', e) }

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
      console.error('Contribute error:', error)
      setIsContributing(false)
      setTransactionStatus(null)
      return { success: false, error: msg }
    }
  }, [connected, address, executeTransaction, requestRecords, decrypt, disconnect])

  return { contribute, isContributing, transactionStatus }
}
