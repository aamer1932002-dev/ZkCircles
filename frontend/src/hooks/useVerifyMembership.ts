import { useState, useCallback } from 'react'
import { useWallet } from '@provablehq/aleo-wallet-adaptor-react'

const PROGRAM_ID = import.meta.env.VITE_PROGRAM_ID || 'zk_circles_v3.aleo'
const BASE_FEE = 300_000 // 0.3 ALEO in microcredits

interface VerifyResult {
  success: boolean
  isVerified?: boolean
  transactionId?: string
  error?: string
}

function buildRecordPlaintext(rec: Record<string, unknown>): string | null {
  try {
    if (typeof rec.plaintext === 'string') return rec.plaintext as string
    if (typeof rec.recordPlaintext === 'string') return rec.recordPlaintext as string
    return null
  } catch {
    return null
  }
}

export function useVerifyMembership() {
  const { connected, address, executeTransaction, requestRecords, decrypt } = useWallet()
  const [isVerifying, setIsVerifying] = useState(false)
  const [transactionStatus, setTransactionStatus] = useState<string | null>(null)

  /**
   * On-chain membership verification via verify_membership(circle_id: field)
   * The contract asserts self.signer is in the members mapping.
   */
  const verifyMembership = useCallback(async (circleId: string): Promise<VerifyResult> => {
    if (!connected || !address) {
      return { success: false, error: 'Wallet not connected' }
    }
    if (!executeTransaction) {
      return { success: false, error: 'Wallet does not support executeTransaction' }
    }

    setIsVerifying(true)
    setTransactionStatus('Fetching your membership record...')

    try {
      // First check locally to get the actual on-chain circle_id field value
      const records = await requestRecords?.(PROGRAM_ID) || []
      let onChainCircleId: string | null = null

      for (const r of records as any[]) {
        if (r.spent) continue
        let pt: string | null = r.recordPlaintext || r.plaintext || buildRecordPlaintext(r)
        if (!pt && decrypt) {
          const ct = r.ciphertext || r.recordCiphertext
          if (ct) {
            try { pt = await decrypt(ct) } catch {}
          }
        }
        if (pt && pt.includes(circleId)) {
          // Extract circle_id field value from the record plaintext
          const match = pt.match(/circle_id\s*:\s*([0-9a-zA-Z]+field)/)
          onChainCircleId = match ? match[1] : circleId
          break
        }
      }

      if (!onChainCircleId) {
        setIsVerifying(false)
        setTransactionStatus(null)
        return {
          success: true,
          isVerified: false,
          error: 'No membership record found for this circle',
        }
      }

      setTransactionStatus('Awaiting wallet approval...')

      // verify_membership(public circle_id: field) -> Future
      const result = await executeTransaction({
        program: PROGRAM_ID,
        function: 'verify_membership',
        inputs: [onChainCircleId],   // circle_id: field (public)
        fee: BASE_FEE,
        privateFee: false,
      })

      const txId = String(result?.transactionId || result)
      console.log('[VerifyMembership] On-chain TX:', txId)

      setTransactionStatus('Membership verified on-chain!')
      await new Promise(r => setTimeout(r, 1500))

      setIsVerifying(false)
      setTransactionStatus(null)

      return { success: true, isVerified: true, transactionId: txId }
    } catch (error) {
      console.error('[VerifyMembership] Error:', error)
      setIsVerifying(false)
      setTransactionStatus(null)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }, [connected, address, executeTransaction, requestRecords, decrypt])

  /**
   * Fast local membership check - scans wallet records without gas
   */
  const checkMembershipLocally = useCallback(async (circleId: string): Promise<boolean> => {
    if (!connected || !requestRecords) return false
    try {
      const records = await requestRecords(PROGRAM_ID)
      for (const r of (records || []) as any[]) {
        if (r.spent) continue
        const pt = r.recordPlaintext || r.plaintext || buildRecordPlaintext(r)
        if (pt && pt.includes(circleId)) return true
      }
      return false
    } catch {
      return false
    }
  }, [connected, requestRecords])

  return {
    verifyMembership,
    checkMembershipLocally,
    isVerifying,
    transactionStatus,
  }
}
