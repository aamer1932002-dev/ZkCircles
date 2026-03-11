import { useState, useCallback } from 'react'
import { useWallet } from '@provablehq/aleo-wallet-adaptor-react'
import { recordContributionBackend, getCircleDetail } from '../services/api'

const PROGRAM_ID = import.meta.env.VITE_PROGRAM_ID || 'zk_circles_v5.aleo'
const BASE_FEE = 1_000_000

// The pot address collects all contributions for a circle.
const DEFAULT_POT_ADDRESS =
  import.meta.env.VITE_CIRCLE_POT_ADDRESS ||
  'aleo1yvukv56vxntqpc280d40dhuvz4prpwzvdvjcm9ggm8a8e3tffsgqc9ws3t'

/**
 * Reconstruct a record plaintext string from a WalletAdapterRecord.
 * The Provable SDK returns parsed fields in `r.data` (not a raw plaintext
 * string), so we rebuild the string the Leo VM expects as input.
 */
function reconstructPlaintext(r: any): string {
  const raw: string | undefined = r.recordPlaintext || r.plaintext || r.record
  if (raw && typeof raw === 'string') return raw
  if (!r.data) return ''
  const fields = Object.entries(r.data as Record<string, string>)
    .map(([k, v]) => `  ${k}: ${v}`)
    .join(',\n')
  return `{\n  owner: ${r.owner},\n${fields}\n}`
}

interface ContributeResult {
  success: boolean
  transactionId?: string
  error?: string
}

export function useContribute() {
  const { connected, address, executeTransaction, requestRecords, decrypt } = useWallet()
  const [isContributing, setIsContributing] = useState(false)
  const [transactionStatus, setTransactionStatus] = useState<string | null>(null)

  const contribute = useCallback(async (
    circleId: string,
    amount: number,
    potAddress?: string
  ): Promise<ContributeResult> => {
    if (!connected || !address) {
      return { success: false, error: 'Wallet not connected' }
    }
    if (!executeTransaction || !requestRecords) {
      return { success: false, error: 'Wallet does not support required features' }
    }

    setIsContributing(true)
    setTransactionStatus('Fetching your membership record...')

    try {
      // Find the CircleMembership record for this circle
      let membershipPlaintext: string | null = null
      try {
        const programRecords = await requestRecords(PROGRAM_ID) || []
        console.log('[Contribute] Program records count:', (programRecords as any[]).length)

        // Strip the "field" type suffix for bare-number comparisons
        const bareCircleId = circleId.replace(/field$/i, '')

        for (const r of programRecords as any[]) {
          if (r.spent) continue

          // Strategy 1: Provable SDK parses fields into r.data object
          // e.g. r.data = { circle_id: "123field.private", payout_order: "1u8.private" }
          if (r.data?.circle_id) {
            const storedId = String(r.data.circle_id)
              .replace('.private', '')
              .replace('.public', '')
            if (
              storedId === circleId ||
              storedId === bareCircleId ||
              storedId.replace(/field$/i, '') === bareCircleId
            ) {
              membershipPlaintext = reconstructPlaintext(r)
              break
            }
          }

          // Strategy 2: Some adapters expose a pre-decoded plaintext string
          const pt: string | undefined = r.recordPlaintext || r.plaintext || r.record
          if (pt && typeof pt === 'string') {
            if (pt.includes(circleId) || pt.includes(bareCircleId)) {
              membershipPlaintext = pt; break
            }
          }

          // Strategy 3: Encrypted record — decrypt then match
          const ct: string | undefined = r.ciphertext || r.recordCiphertext
          if (ct && decrypt) {
            try {
              const dec = await decrypt(ct)
              const decStr = typeof dec === 'string' ? dec : JSON.stringify(dec)
              if (decStr.includes(circleId) || decStr.includes(bareCircleId)) {
                membershipPlaintext = decStr; break
              }
            } catch { /* try next */ }
          }
        }
      } catch (e) {
        console.warn('[Contribute] Failed to fetch program records:', e)
      }

      if (!membershipPlaintext) {
        throw new Error(
          'No membership record found for this circle. ' +
          'Make sure your join transaction is confirmed on-chain and try again.'
        )
      }

      // Get current cycle from backend
      const response = await getCircleDetail(circleId)
      const cycle = response.circle.currentCycle || 1

      setTransactionStatus('Awaiting wallet approval...')

      // contribute(membership, pot_address, cycle)
      // credits.aleo/transfer_public_as_signer debits signer's public balance atomically
      const result = await executeTransaction({
        program: PROGRAM_ID,
        function: 'contribute',
        inputs: [
          membershipPlaintext,                    // membership: CircleMembership
          potAddress || DEFAULT_POT_ADDRESS,      // pot_address: address (public)
          `${cycle}u8`,                           // cycle: u8 (public)
        ],
        fee: BASE_FEE,
        privateFee: false,
      })

      const txId = String(result?.transactionId || result)
      console.log('[Contribute] TX:', txId)
      setTransactionStatus('Contribution recorded on-chain!')
      await new Promise(resolve => setTimeout(resolve, 2000))

      try {
        await recordContributionBackend({
          circleId,
          memberAddress: address,
          cycle,
          amount,
          transactionId: txId,
        })
      } catch (e) { console.warn('Backend record failed (non-critical):', e) }

      setIsContributing(false)
      setTransactionStatus(null)
      return { success: true, transactionId: txId }
    } catch (error) {
      console.error('Contribute error:', error)
      setIsContributing(false)
      setTransactionStatus(null)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }, [connected, address, executeTransaction, requestRecords, decrypt])

  return { contribute, isContributing, transactionStatus }
}
