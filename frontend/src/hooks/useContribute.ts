import { useState, useCallback } from 'react'
import { useWallet } from '@provablehq/aleo-wallet-adaptor-react'
import { recordContributionBackend, getCircleDetail } from '../services/api'

const PROGRAM_ID = import.meta.env.VITE_PROGRAM_ID || 'zk_circles_v2.aleo'
const CREDITS_PROGRAM = 'credits.aleo'
const BASE_FEE = 1_000_000 // 1 ALEO in microcredits — Shield Wallet requires non-zero fee

// Circle pot address - in production this would be the program's address
const CIRCLE_POT_ADDRESS = import.meta.env.VITE_CIRCLE_POT_ADDRESS || 'aleo1yvukv56vxntqpc280d40dhuvz4prpwzvdvjcm9ggm8a8e3tffsgqc9ws3t'

interface ContributeResult {
  success: boolean
  transactionId?: string
  creditsTransactionId?: string
  error?: string
}

/**
 * Build plaintext string from a record object
 * Handles different formats from Leo Wallet and Shield Wallet
 */
function buildCreditsPlaintext(rec: Record<string, unknown>): string | null {
  try {
    // Already plaintext
    if (typeof rec.plaintext === 'string') return rec.plaintext as string
    if (typeof rec.recordPlaintext === 'string') return rec.recordPlaintext as string

    // Construct from parts
    let owner = rec.owner as string
    if (!owner) return null
    if (!owner.endsWith('.private')) owner += '.private'

    const data = rec.data as Record<string, unknown> | undefined
    let mcRaw = String(data?.microcredits || rec.microcredits || '')
    const mcValue = mcRaw.match(/(\d[\d_]*)/)?.[1]?.replace(/_/g, '')
    if (!mcValue) return null

    let nonce = String(rec.nonce || (rec as any)._nonce || '0group.public')
    if (!nonce.includes('group')) nonce += 'group.public'

    return `{\n  owner: ${owner},\n  microcredits: ${mcValue}u64.private,\n  _nonce: ${nonce}\n}`
  } catch {
    return null
  }
}

/**
 * Extract microcredits balance from a record
 */
function extractMicrocredits(rec: Record<string, unknown>): number {
  // Try plaintext
  if (typeof rec.plaintext === 'string') {
    const match = (rec.plaintext as string).match(/microcredits\s*:\s*(\d[\d_]*)/)
    if (match) return parseInt(match[1].replace(/_/g, ''), 10)
  }

  // Try data field
  const data = rec.data as Record<string, unknown> | undefined
  if (data?.microcredits) {
    const val = String(data.microcredits).replace(/u64|\.private|_/g, '')
    return parseInt(val, 10) || 0
  }

  // Try root field
  if (rec.microcredits) {
    const val = String(rec.microcredits).replace(/u64|\.private|_/g, '')
    return parseInt(val, 10) || 0
  }

  return 0
}

export function useContribute() {
  const { connected, address, executeTransaction, requestRecords, decrypt } = useWallet()
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
    setTransactionStatus('Fetching your records...')

    try {
      // Step 1: Get user's credits records for the transfer
      let recordPlaintext: string | null = null
      const minNeeded = amount + BASE_FEE

      try {
        const records = await requestRecords(CREDITS_PROGRAM)
        console.log('[Contribute] Credits records:', records)

        for (const r of (records || []) as any[]) {
          if (r.spent) continue

          // 1. Shield Wallet — use recordPlaintext directly
          if (r.recordPlaintext) {
            const mc = extractMicrocredits({ plaintext: r.recordPlaintext })
            if (mc >= minNeeded) {
              recordPlaintext = r.recordPlaintext
              break
            }
          }

          // 2. If it's already a plaintext string
          if (typeof r === 'string' && r.includes('microcredits')) {
            const mc = extractMicrocredits({ plaintext: r })
            if (mc >= minNeeded) {
              recordPlaintext = r
              break
            }
          }

          // 3. Try decrypting ciphertext
          const ct = r.ciphertext || r.recordCiphertext
          if (ct && decrypt) {
            try {
              const pt = await decrypt(ct)
              if (pt && typeof pt === 'string') {
                const mc = extractMicrocredits({ plaintext: pt })
                if (mc >= minNeeded) {
                  recordPlaintext = pt
                  break
                }
              }
            } catch { /* try next */ }
          }

          // 4. Construct plaintext from fields (Leo Wallet format)
          const pt = buildCreditsPlaintext(r)
          if (pt) {
            const mc = extractMicrocredits({ plaintext: pt })
            if (mc >= minNeeded) {
              recordPlaintext = pt
              break
            }
          }
        }
      } catch (e) {
        console.warn('[Contribute] Could not fetch credits records:', e)
      }

      if (!recordPlaintext) {
        throw new Error(
          `No usable credits record found. You need at least ${(minNeeded / 1_000_000).toFixed(3)} ALEO. Try shielding more credits in your wallet.`
        )
      }

      setTransactionStatus('Fetching your membership record...')

      // Step 2: Get membership record for this circle
      let membershipPlaintext: string | null = null
      try {
        const programRecords = await requestRecords(PROGRAM_ID) || []
        console.log('[Contribute] Program records:', programRecords)

        for (const r of programRecords as any[]) {
          if (r.spent) continue
          const pt = r.recordPlaintext || r.plaintext
          if (pt && pt.includes(circleId)) {
            membershipPlaintext = pt
            break
          }
          // Try decrypt
          const ct = r.ciphertext || r.recordCiphertext
          if (ct && decrypt) {
            try {
              const decPt = await decrypt(ct)
              if (decPt && typeof decPt === 'string' && decPt.includes(circleId)) {
                membershipPlaintext = decPt
                break
              }
            } catch { /* try next */ }
          }
        }
      } catch (e) {
        console.warn('[Contribute] Failed to fetch program records:', e)
      }

      if (!membershipPlaintext) {
        throw new Error('No membership record found for this circle. Make sure you have joined this circle.')
      }

      // Step 3: Get current cycle number from backend
      const response = await getCircleDetail(circleId)
      const cycleNumber = response.circle.currentCycle || 1

      setTransactionStatus('Awaiting wallet approval...')

      // Step 4: Single transaction — contribute() handles credits transfer internally
      // Contract: contribute(membership, payment, pot_address, cycle_number)
      const result = await executeTransaction({
        program: PROGRAM_ID,
        function: 'contribute',
        inputs: [
          membershipPlaintext,               // membership: CircleMembership
          recordPlaintext,                   // payment: credits.aleo/credits
          CIRCLE_POT_ADDRESS,               // pot_address: address (public)
          `${cycleNumber}u8`,               // cycle_number: u8 (public)
        ],
        fee: BASE_FEE,
        privateFee: false, // CRITICAL: Shield Wallet requires privateFee: false
      })

      const txId = String(result?.transactionId || result)
      console.log('[Contribute] Transaction ID:', txId)

      setTransactionStatus('Contribution submitted successfully!')
      await new Promise(resolve => setTimeout(resolve, 2000))

      // Record in backend
      try {
        await recordContributionBackend({
          circleId,
          memberAddress: address,
          cycle: cycleNumber,
          amount,
          transactionId: txId,
        })
      } catch (backendError) {
        console.warn('Backend record failed (non-critical):', backendError)
      }

      setIsContributing(false)
      setTransactionStatus(null)

      return {
        success: true,
        transactionId: txId,
        creditsTransactionId: txId,
      }
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

  return {
    contribute,
    isContributing,
    transactionStatus,
  }
}
