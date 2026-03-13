import { useState, useCallback } from 'react'
import { useWallet } from '@provablehq/aleo-wallet-adaptor-react'
import { PROGRAM_ID, FEE_VERIFY } from '../config'
import { isStalePermissionsError, STALE_PERMISSIONS_USER_MSG, dispatchStalePermissionsEvent } from '../utils/walletErrors'

const BASE_FEE = FEE_VERIFY

interface VerifyResult {
  success: boolean
  isVerified?: boolean
  transactionId?: string
  error?: string
}

export function useVerifyMembership() {
  const { connected, address, executeTransaction, disconnect } = useWallet()
  const [isVerifying, setIsVerifying] = useState(false)
  const [transactionStatus, setTransactionStatus] = useState<string | null>(null)

  /**
   * Submit verify_membership on-chain.
   *
   * The Leo transition:  verify_membership(public circle_id: field) -> Future
   * It reads self.signer internally — only ONE input needed (circle_id).
   * No private membership record is passed.
   */
  const verifyMembership = useCallback(async (circleId: string): Promise<VerifyResult> => {
    if (!connected || !address) return { success: false, error: 'Wallet not connected' }
    if (!executeTransaction) return { success: false, error: 'Wallet does not support transactions' }

    setIsVerifying(true)
    setTransactionStatus('Submitting on-chain verification…')

    try {
      const result = await executeTransaction({
        program: PROGRAM_ID,
        function: 'verify_membership',
        inputs: [circleId],   // public circle_id: field — only input
        fee: BASE_FEE,
        privateFee: false,
      })

      const txId = String((result as any)?.transactionId || result)
      console.log('[VerifyMembership] TX:', txId)
      setTransactionStatus('Membership verified on-chain!')
      await new Promise(r => setTimeout(r, 1500))
      setIsVerifying(false)
      setTransactionStatus(null)
      return { success: true, isVerified: true, transactionId: txId }
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error'
      if (isStalePermissionsError(msg)) {
        try { await disconnect?.() } catch { /* ignore */ }
        dispatchStalePermissionsEvent()
        setIsVerifying(false)
        setTransactionStatus(null)
        return { success: false, error: STALE_PERMISSIONS_USER_MSG }
      }
      console.error('[VerifyMembership] Error:', error)
      setIsVerifying(false)
      setTransactionStatus(null)
      return { success: false, error: msg }
    }
  }, [connected, address, executeTransaction])

  return { verifyMembership, isVerifying, transactionStatus }
}
