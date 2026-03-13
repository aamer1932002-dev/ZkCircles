import { useState, useCallback } from 'react'
import { useWallet } from '@provablehq/aleo-wallet-adaptor-react'
import { recordContributionBackend, getCircleDetail } from '../services/api'
import {
  getCachedMembership,
  setCachedMembership,
  clearCachedMembership,
  setJoinTxId,
  getJoinTxId,
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
import { isStalePermissionsError, STALE_PERMISSIONS_USER_MSG, dispatchStalePermissionsEvent, isRecordNotFoundError, RECORD_NOT_FOUND_USER_MSG } from '../utils/walletErrors'

const BASE_FEE = FEE_CONTRIBUTE

interface ContributeResult {
  success: boolean
  transactionId?: string
  error?: string
}

export function useContribute() {
  const wallet = useWallet() as any
  const { connected, address, executeTransaction, requestRecords, decrypt, disconnect } = wallet
  // Shield Wallet returns a temp 'shield_…' ID from executeTransaction().
  // walletTxStatus() lets trackTransaction() resolve it to the real at1… on-chain ID.
  const walletTxStatus: ((id: string) => Promise<{ status?: string; transactionId?: string }>) | undefined =
    wallet.transactionStatus
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

      // 1c. Layer 3: fetch record ciphertext directly from the Aleo explorer
      //     using the stored TX ID (join or most recent contribute).
      //     contribute emits (CircleMembership, ContributionReceipt, ...) so
      //     the CircleMembership is always record output index 0.
      //     Immediately decrypt to plaintext+nonce so executeTransaction works
      //     WITHOUT the wallet having locally indexed the record yet.
      if (!recordInput) {
        const storedTxId = getJoinTxId(address, circleId)
        if (storedTxId) {
          setTransactionStatus('Fetching record from Aleo blockchain…')
          console.log('[Contribute] Layer 3: fetching record[0] from tx', storedTxId)
          const ciphertext = await fetchRecordByIndexFromChain(storedTxId, PROGRAM_ID, 0)
          if (ciphertext) {
            if (decrypt) {
              // Decrypt immediately → plaintext+nonce works in executeTransaction
              // even if the wallet hasn't indexed this record yet
              recordInput = await decryptAndCacheMembership(address, circleId, ciphertext, decrypt)
              console.log('[Contribute] Layer 3 success (decrypted)')
            } else {
              recordInput = ciphertext
              setCachedMembership(address, circleId, ciphertext)
              console.log('[Contribute] Layer 3 success (ciphertext, no decrypt available)')
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
            'Your wallet may not have synced the record from the previous transaction yet.\n\n' +
            '• Open Shield Wallet → tap the sync/refresh icon\n' +
            '• Wait 30–60 seconds, then try again\n' +
            '• If the problem persists, disconnect and reconnect your wallet',
        }
      }

      // ── Step 2: Get current cycle — prefer on-chain truth ────────────────
      setTransactionStatus('Verifying on-chain circle state…')
      const onChain = await queryCircleOnChain(circleId)
      const response = await getCircleDetail(circleId)
      let cycle: number

      if (onChain) {
        console.log('[Contribute] On-chain CircleInfo:', onChain)
        if (onChain.status !== 1) {
          const names: Record<number, string> = { 0: 'Forming', 1: 'Active', 2: 'Completed', 3: 'Cancelled' }
          return {
            success: false,
            error: `Circle is "${names[onChain.status] || onChain.status}" on-chain. Contributions are only accepted when Active.`,
          }
        }
        cycle = onChain.current_cycle
        if (cycle === 0) {
          return { success: false, error: 'Circle has not started yet on-chain (current_cycle = 0). Ensure all members have joined.' }
        }
      } else {
        console.warn('[Contribute] On-chain query failed, using backend data')
        cycle = response.circle.currentCycle || 1
      }

      setTransactionStatus('Awaiting wallet approval…')

      // ── Final guard: ensure recordInput is a CircleMembership ────────────
      // Shield Wallet's decrypt() can return the wrong record type (e.g. a
      // ContributionReceipt) if its internal queue is out of order. Catch this
      // before we hit the wallet to get a clear error instead of a cryptic one.
      if (!recordInput.startsWith('record1')) {
        // It's a plaintext — check record type
        if (/\bcycle\b/.test(recordInput) && !recordInput.includes('contribution_amount')) {
          console.error('[Contribute] recordInput is wrong type (ContributionReceipt/PayoutReceipt). Clearing cache.', recordInput.slice(0, 200))
          clearCachedMembership(address, circleId)
          setIsContributing(false)
          setTransactionStatus(null)
          return {
            success: false,
            error:
              'Wrong record type in cache (ContributionReceipt instead of CircleMembership).\n\n' +
              'This is a known Shield Wallet quirk. Please:\n' +
              '• Open Shield Wallet → tap the sync/refresh icon\n' +
              '• Wait 30 seconds, then try again\n' +
              '• The correct record will be fetched automatically on retry.',
          }
        }
      }

      // ── Step 3: Submit contribute(membership, cycle) ─────────────────────
      const fmt = recordInput.startsWith('record1')
        ? 'ciphertext'
        : recordInput.includes('_nonce') ? 'plaintext+nonce' : 'bare-plaintext'
      console.log(`[Contribute] executeTransaction: cycle=${cycle}u8, record=[${fmt}]`)

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

      // ── Step 4: Track on-chain confirmation ─────────────────────────────
      const confirmation = await trackTransaction(txId, setTransactionStatus, 180_000, 6_000, walletTxStatus)

      if (confirmation.status === 'rejected') {
        // Do NOT clear cache on rejection — the record was not consumed
        // (the TX was rejected before finalize could spend it)
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

      // ── Step 5: Accepted — update caches & backend ──────────────────────
      setTransactionStatus('Confirmed on-chain!')
      clearCachedMembership(address, circleId)
      setJoinTxId(address, circleId, confirmation.txId) // Layer 3 will use the real on-chain ID

      // Strategy: store the raw ciphertext FIRST (guaranteed usable for Layer 3
      // on the next cycle), then ALSO try to decrypt to plaintext+nonce for
      // the best possible input format.  This way the cache is never empty.
      try {
        // Primary: get ciphertext from transaction tracker's parsed outputs
        let ciphertext: string | null =
          (confirmation.recordOutputs?.length ? confirmation.recordOutputs[0] : null) ?? null

        // Secondary: fetch directly from chain if tracker didn't capture it
        if (!ciphertext) {
          ciphertext = await fetchRecordByIndexFromChain(confirmation.txId, PROGRAM_ID, 0)
        }

        if (ciphertext) {
          // Store raw ciphertext immediately so Layer 3 always has something
          setCachedMembership(address, circleId, ciphertext)
          console.log('[Contribute] Step 5: cached raw ciphertext')

          if (decrypt) {
            // Upgrade to decrypted plaintext (avoids wallet indexing dependency)
            const plaintext = await decryptAndCacheMembership(address, circleId, ciphertext, decrypt)
            console.log('[Contribute] Step 5: upgraded to decrypted plaintext, has_nonce=', plaintext.includes('_nonce'))
          }
        } else {
          // Last resort poll
          await new Promise(r => setTimeout(r, 3000))
          const fresh = await pollForMembershipRecord(
            requestRecords as any, decrypt, circleId, () => {}, 'PostContribute', 2
          )
          if (fresh) setCachedMembership(address, circleId, fresh)
        }
      } catch (e) {
        console.warn('[Contribute] Step 5: cache update failed (non-critical):', e)
      }

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
      if (isRecordNotFoundError(msg)) {
        setIsContributing(false)
        setTransactionStatus(null)
        return { success: false, error: RECORD_NOT_FOUND_USER_MSG }
      }
      console.error('Contribute error:', error)
      setIsContributing(false)
      setTransactionStatus(null)
      return { success: false, error: msg }
    }
  }, [connected, address, executeTransaction, requestRecords, decrypt, disconnect])

  return { contribute, isContributing, transactionStatus }
}
