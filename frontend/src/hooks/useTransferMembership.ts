import { useState, useCallback } from 'react'
import { useWallet } from '@provablehq/aleo-wallet-adaptor-react'

const PROGRAM_ID = import.meta.env.VITE_PROGRAM_ID || 'zk_circles_v1.aleo'
const BASE_FEE = 500_000 // 0.5 ALEO in microcredits

interface TransferResult {
  success: boolean
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

export function useTransferMembership() {
  const { connected, address, executeTransaction, requestRecords, decrypt } = useWallet()
  const [isTransferring, setIsTransferring] = useState(false)
  const [transactionStatus, setTransactionStatus] = useState<string | null>(null)

  const transferMembership = useCallback(async (
    circleId: string,
    newOwnerAddress: string
  ): Promise<TransferResult> => {
    if (!connected || !address) {
      return { success: false, error: 'Wallet not connected' }
    }

    if (!requestRecords || !executeTransaction) {
      return { success: false, error: 'Wallet does not support required features' }
    }

    // Validate new owner address
    if (!newOwnerAddress.startsWith('aleo1') || newOwnerAddress.length !== 63) {
      return { success: false, error: 'Invalid Aleo address format' }
    }

    if (newOwnerAddress === address) {
      return { success: false, error: 'Cannot transfer to yourself' }
    }

    setIsTransferring(true)
    setTransactionStatus('Fetching your membership records...')

    try {
      // Get user's membership records
      const records = await requestRecords(PROGRAM_ID)
      console.log('[TransferMembership] Records:', records)
      
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
        throw new Error('Membership record not found. Are you a member of this circle?')
      }

      setTransactionStatus('Awaiting wallet approval...')

      // Execute the transfer transaction
      const result = await executeTransaction({
        program: PROGRAM_ID,
        function: 'transfer_membership',
        inputs: [
          membershipPlaintext,  // membership: CircleMembership record
          newOwnerAddress,      // new_owner: address
        ],
        fee: BASE_FEE,
        privateFee: false, // CRITICAL: Shield Wallet requires privateFee: false
      })

      const txId = String(result?.transactionId || result)
      console.log('[TransferMembership] Transaction ID:', txId)
      
      setTransactionStatus('Transaction submitted!')

      // Wait briefly for wallet to process
      await new Promise(resolve => setTimeout(resolve, 2000))
      setTransactionStatus('Membership transferred successfully!')

      setIsTransferring(false)
      setTransactionStatus(null)

      return {
        success: true,
        transactionId: txId,
      }
    } catch (error) {
      console.error('[TransferMembership] Error:', error)
      setIsTransferring(false)
      setTransactionStatus(null)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }, [connected, address, executeTransaction, requestRecords, decrypt])

  return {
    transferMembership,
    isTransferring,
    transactionStatus,
  }
}
