import { useState, useCallback } from 'react'
import { useWallet } from '@provablehq/aleo-wallet-adaptor-react'
import { PROGRAM_ID, FEE_DISPUTE } from '../config'
import { isStalePermissionsError, STALE_PERMISSIONS_USER_MSG, dispatchStalePermissionsEvent } from '../utils/walletErrors'

interface DisputeResult {
  success: boolean
  transactionId?: string
  error?: string
}

/**
 * useDisputeResolution
 *
 * Wraps the flag_missed_contribution transition in zk_circles_v7.aleo.
 *
 * Transition signature:
 *   flag_missed_contribution(membership: CircleMembership, public defaulter: address, public cycle: u8)
 *     -> (CircleMembership, Future)
 *
 * Any circle member can call this after a cycle has advanced (current_cycle > cycle)
 * if another member failed to contribute during that cycle.  The on-chain mapping
 * increments the defaulter's missed-payment count and prevents double-flagging the
 * same (defaulter, cycle) pair.
 *
 * The caller's CircleMembership record is returned unchanged so the wallet retains it.
 */
export function useDisputeResolution() {
  const { connected, address, executeTransaction, disconnect } = useWallet()
  const [isFlagging, setIsFlagging] = useState(false)
  const [transactionStatus, setTransactionStatus] = useState<string | null>(null)

  const flagMissedContribution = useCallback(async (
    membershipRecord: string,   // serialised CircleMembership record passed from wallet
    defaulterAddress: string,
    cycle: number,
  ): Promise<DisputeResult> => {
    if (!connected || !address) return { success: false, error: 'Wallet not connected' }
    if (!executeTransaction) return { success: false, error: 'Wallet does not support transactions' }
    if (address === defaulterAddress) return { success: false, error: 'You cannot flag yourself' }

    setIsFlagging(true)
    setTransactionStatus('Submitting dispute on-chain…')

    try {
      const result = await executeTransaction({
        program: PROGRAM_ID,
        function: 'flag_missed_contribution',
        inputs: [membershipRecord, defaulterAddress, `${cycle}u8`],
        fee: FEE_DISPUTE,
        privateFee: false,
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
  }, [connected, address, executeTransaction, disconnect])

  return { flagMissedContribution, isFlagging, transactionStatus }
}
