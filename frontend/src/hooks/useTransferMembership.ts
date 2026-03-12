import { useState, useCallback } from 'react'
import { useWallet } from '@provablehq/aleo-wallet-adaptor-react'
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
import { trackTransaction } from '../utils/transactionTracker'
import { PROGRAM_ID, FEE_TRANSFER } from '../config'
import { isStalePermissionsError, STALE_PERMISSIONS_USER_MSG, dispatchStalePermissionsEvent } from '../utils/walletErrors'

const BASE_FEE = FEE_TRANSFER

interface TransferResult {
  success: boolean
  transactionId?: string
  error?: string
}

export function useTransferMembership() {
  const { connected, address, executeTransaction, requestRecords, decrypt, disconnect } = useWallet()
  const [isTransferring, setIsTransferring] = useState(false)
  const [transactionStatus, setTransactionStatus] = useState<string | null>(null)

  const transferMembership = useCallback(async (
    circleId: string,
    newOwnerAddress: string
  ): Promise<TransferResult> => {
    if (!connected || !address) return { success: false, error: 'Wallet not connected' }
    if (!executeTransaction || !requestRecords) return { success: false, error: 'Wallet does not support required features' }
    if (!newOwnerAddress || !newOwnerAddress.startsWith('aleo1'))
      return { success: false, error: 'Invalid new owner address' }

    setIsTransferring(true)
    setTransactionStatus('Looking up your membership record…')

    try {
      let membershipInput: string | null = null

      // ── Layer 1: cache ── resolveCachedRecord decrypts ciphertext
      const cached = getCachedMembership(address, circleId)
      if (cached) {
        const resolved = await resolveCachedRecord(cached, decrypt)
        if (resolved) {
          console.log('[Transfer] cache hit')
          membershipInput = resolved
          if (resolved !== cached) setCachedMembership(address, circleId, resolved)
        } else {
          console.warn('[Transfer] Cached record unusable — clearing')
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
          'Transfer'
        )
        if (membershipInput) setCachedMembership(address, circleId, membershipInput)
      }

      // ── Layer 3: fetch ciphertext from Aleo testnet → decrypt it
      if (!membershipInput) {
        const txId = getJoinTxId(address, circleId)
        if (txId) {
          setTransactionStatus('Fetching record from Aleo testnet…')
          console.log('[Transfer] querying testnet for txId:', txId)
          const ciphertext = await fetchRecordCiphertextFromChain(txId, PROGRAM_ID)
          if (ciphertext) {
            const resolved = await resolveCachedRecord(ciphertext, decrypt)
            if (resolved) {
              console.log('[Transfer] using chain record (decrypted:', resolved !== ciphertext, ')')
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

      setTransactionStatus('Awaiting wallet approval…')

      const fmt = membershipInput.startsWith('record1')
        ? 'ciphertext'
        : membershipInput.includes('_nonce') ? 'plaintext+nonce' : 'bare-plaintext'
      console.log(`[Transfer] executeTransaction input[0] format: ${fmt}, length: ${membershipInput.length}`)
      console.log('[Transfer] input[0] first 120 chars:', membershipInput.slice(0, 120))

      const result = await executeTransaction({
        program: PROGRAM_ID,
        function: 'transfer_membership',
        inputs: [
          membershipInput,    // membership: CircleMembership
          newOwnerAddress,    // new_owner: address (public)
        ],
        fee: BASE_FEE,
        privateFee: false,
        recordIndices: [0],   // Tell wallet that inputs[0] is a record
      })

      const txId = String((result as any)?.transactionId || result)
      console.log('[Transfer] TX:', txId)

      // Track on-chain confirmation
      const confirmation = await trackTransaction(txId, setTransactionStatus)

      if (confirmation.status === 'rejected') {
        setIsTransferring(false)
        setTransactionStatus(null)
        return {
          success: false, transactionId: txId,
          error: `Transfer REJECTED on-chain.\n${confirmation.rejectionReason || 'Finalize failed.'}\nTX: ${txId.slice(0, 24)}…`,
        }
      }

      if (confirmation.status === 'timeout') {
        setIsTransferring(false)
        setTransactionStatus(null)
        return {
          success: false, transactionId: txId,
          error: `Could not confirm transfer on-chain within timeout. TX: ${txId.slice(0, 24)}…`,
        }
      }

      // Accepted — sender's record is consumed
      setTransactionStatus('Transfer confirmed on-chain!')
      clearCachedMembership(address, circleId)

      setIsTransferring(false)
      setTransactionStatus(null)
      return { success: true, transactionId: txId }
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error'
      if (isStalePermissionsError(msg)) {
        try { await disconnect?.() } catch { /* ignore */ }
        dispatchStalePermissionsEvent()
        setIsTransferring(false)
        setTransactionStatus(null)
        return { success: false, error: STALE_PERMISSIONS_USER_MSG }
      }
      console.error('Transfer error:', error)
      setIsTransferring(false)
      setTransactionStatus(null)
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
    }
  }, [connected, address, executeTransaction, requestRecords, decrypt])

  return { transferMembership, isTransferring, transactionStatus }
}
