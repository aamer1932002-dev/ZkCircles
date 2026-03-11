import { useState, useCallback } from 'react'
import { useWallet } from '@provablehq/aleo-wallet-adaptor-react'
import { getCachedMembership } from '../utils/membershipCache'
import { PROGRAM_ID, FEE_VERIFY } from '../config'

const BASE_FEE = FEE_VERIFY

interface VerifyResult {
  success: boolean
  isVerified?: boolean
  transactionId?: string
  error?: string
}

export function useVerifyMembership() {
  const { connected, address, executeTransaction, requestRecords } = useWallet()
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
      console.error('[VerifyMembership] Error:', error)
      setIsVerifying(false)
      setTransactionStatus(null)
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
    }
  }, [connected, address, executeTransaction])

  /**
   * Quick local check — looks in cache first, then requestRecords.
   * Does NOT submit any on-chain transaction.
   */
  const checkMembershipLocally = useCallback(async (circleId: string): Promise<boolean> => {
    if (!connected || !address) return false

    // Check cache
    if (getCachedMembership(address, circleId)) return true

    // Fall back to requestRecords
    if (!requestRecords) return false
    try {
      const records: any[] = (await (requestRecords as any)(PROGRAM_ID, true)) || []
      const bareId = circleId.replace(/field$/i, '')
      for (const r of records) {
        if (r.data?.circle_id) {
          const sid = String(r.data.circle_id).replace('.private', '').replace('.public', '')
          if (sid === circleId || sid === bareId || sid.replace(/field$/i, '') === bareId) return true
        }
        const pt = r.recordPlaintext || r.plaintext || r.record
        if (pt && typeof pt === 'string' && (pt.includes(circleId) || pt.includes(bareId))) return true
      }
      return false
    } catch {
      return false
    }
  }, [connected, address, requestRecords])

  return { verifyMembership, checkMembershipLocally, isVerifying, transactionStatus }
}
