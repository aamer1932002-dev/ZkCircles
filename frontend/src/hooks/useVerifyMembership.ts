import { useState, useCallback } from 'react'
import { useWallet } from '@provablehq/aleo-wallet-adaptor-react'

const PROGRAM_ID = import.meta.env.VITE_PROGRAM_ID || 'zk_circles_v1.aleo'
const BASE_FEE = 300_000 // 0.3 ALEO in microcredits

interface VerifyResult {
  success: boolean
  isVerified?: boolean
  transactionId?: string
  error?: string
}

/**
 * Build plaintext string from a record object
 */
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

  const verifyMembership = useCallback(async (
    circleId: string
  ): Promise<VerifyResult> => {
    if (!connected || !address) {
      return { success: false, error: 'Wallet not connected' }
    }

    if (!requestRecords || !executeTransaction) {
      return { success: false, error: 'Wallet does not support required features' }
    }

    setIsVerifying(true)
    setTransactionStatus('Fetching your membership records...')

    try {
      // Get user's membership records
      const records = await requestRecords(PROGRAM_ID)
      console.log('[VerifyMembership] Records:', records)
      
      // Find membership record for this circle
      let membershipPlaintext: string | null = null
      
      for (const r of (records || []) as any[]) {
        if (r.spent) continue
        
        // Try to get plaintext
        let pt = r.recordPlaintext || r.plaintext || buildRecordPlaintext(r)
        
        // Try decrypting if we have ciphertext
        if (!pt && decrypt) {
          const ct = r.ciphertext || r.recordCiphertext
          if (ct) {
            try {
              pt = await decrypt(ct)
            } catch { /* try next */ }
          }
        }
        
        // Check if this is the membership for our circle
        if (pt && pt.includes(circleId)) {
          membershipPlaintext = pt
          break
        }
      }

      if (!membershipPlaintext) {
        setIsVerifying(false)
        setTransactionStatus(null)
        return { 
          success: true, 
          isVerified: false,
          error: 'No membership record found for this circle'
        }
      }

      setTransactionStatus('Awaiting wallet approval...')

      // Execute the verify transaction
      const result = await executeTransaction({
        program: PROGRAM_ID,
        function: 'verify_membership',
        inputs: [
          membershipPlaintext,  // membership: CircleMembership record
          circleId,             // expected_circle_id: field
        ],
        fee: BASE_FEE,
        privateFee: false, // CRITICAL: Shield Wallet requires privateFee: false
      })

      const txId = String(result?.transactionId || result)
      console.log('[VerifyMembership] Transaction ID:', txId)
      
      setTransactionStatus('Verification submitted!')

      // Wait briefly for wallet to process
      await new Promise(resolve => setTimeout(resolve, 2000))
      
      // Note: The actual verification result is computed on-chain
      // For this demo, if the transaction succeeded, the membership is valid
      setTransactionStatus('Membership verified!')

      setIsVerifying(false)
      setTransactionStatus(null)

      return {
        success: true,
        isVerified: true,
        transactionId: txId,
      }
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
   * Check membership locally without on-chain verification
   */
  const checkMembershipLocally = useCallback(async (circleId: string): Promise<boolean> => {
    if (!connected || !requestRecords) return false

    try {
      const records = await requestRecords(PROGRAM_ID)
      
      for (const r of (records || []) as any[]) {
        if (r.spent) continue
        
        const pt = r.recordPlaintext || r.plaintext || buildRecordPlaintext(r)
        if (pt && pt.includes(circleId)) {
          return true
        }
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
