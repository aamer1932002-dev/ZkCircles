import { useState, useCallback } from 'react'
import { useWallet } from '@provablehq/aleo-wallet-adaptor-react'
import { recordContributionBackend, getCircleDetail } from '../services/api'
import {
  getCachedMembership,
  setCachedMembership,
  getJoinTxId,
  fetchRecordCiphertextFromChain,
} from '../utils/membershipCache'
import { PROGRAM_ID, CIRCLE_POT_ADDRESS, FEE_CONTRIBUTE } from '../config'

const BASE_FEE = FEE_CONTRIBUTE
const DEFAULT_POT_ADDRESS = CIRCLE_POT_ADDRESS

function reconstructPlaintext(r: any): string {
  const raw: string | undefined = r.recordPlaintext || r.plaintext || r.record
  if (raw && typeof raw === 'string') return raw
  if (!r.data) return ''
  const fields = Object.entries(r.data as Record<string, string>)
    .map(([k, v]) => `  ${k}: ${v}`)
    .join(',\n')
  return `{\n  owner: ${r.owner},\n${fields}\n}`
}

function matchRecord(r: any, circleId: string, bareId: string): string | null {
  if (r.data?.circle_id) {
    const sid = String(r.data.circle_id).replace('.private', '').replace('.public', '')
    if (sid === circleId || sid === bareId || sid.replace(/field$/i, '') === bareId)
      return reconstructPlaintext(r)
  }
  const pt: string | undefined = r.recordPlaintext || r.plaintext || r.record
  if (pt && typeof pt === 'string' && (pt.includes(circleId) || pt.includes(bareId))) return pt
  return null
}

/**
 * Poll requestRecords up to 5 times with increasing delays.
 * returns the plaintext/ciphertext string or null.
 */
async function pollWalletRecords(
  requestRecords: (program: string) => Promise<any>,
  decrypt: ((ct: string) => Promise<any>) | undefined,
  circleId: string,
  onStatus: (msg: string) => void
): Promise<string | null> {
  const bareId = circleId.replace(/field$/i, '')
  const delays = [0, 2000, 4000, 5000, 5000]

  for (let i = 0; i < 5; i++) {
    if (delays[i] > 0) {
      onStatus(`Waiting for wallet to sync records… (${i + 1}/5)`)
      await new Promise(r => setTimeout(r, delays[i]))
    }
    try {
      const records: any[] = (await requestRecords(PROGRAM_ID)) || []
      console.log(`[Contribute] wallet poll ${i + 1}: ${records.length} records`)
      if (i === 0 && records.length > 0) console.log('[Contribute] sample:', JSON.stringify(records[0]))

      // Pass 1: non-spent
      for (const r of records) { if (r.spent) continue; const f = matchRecord(r, circleId, bareId); if (f) return f }
      // Pass 2: ignore spent flag (Shield marks prematurely)
      for (const r of records) { const f = matchRecord(r, circleId, bareId); if (f) return f }
      // Pass 3: decrypt ciphertext
      if (decrypt) {
        for (const r of records) {
          const ct = r.ciphertext || r.recordCiphertext
          if (!ct) continue
          // Also try passing ciphertext directly if it looks like a record
          if (typeof ct === 'string' && ct.startsWith('record1')) return ct
          try {
            const dec = await decrypt(ct)
            const s = typeof dec === 'string' ? dec : JSON.stringify(dec)
            if (s.includes(circleId) || s.includes(bareId)) return s
          } catch { /* next */ }
        }
      }
    } catch (err: any) {
      console.warn(`[Contribute] wallet poll ${i + 1} error:`, err?.message)
    }
  }
  return null
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
    if (!connected || !address) return { success: false, error: 'Wallet not connected' }
    if (!executeTransaction || !requestRecords) return { success: false, error: 'Wallet does not support required features' }

    setIsContributing(true)
    setTransactionStatus('Looking up your membership record…')

    try {
      let membershipInput: string | null = null

      // ── Layer 1: localStorage cache ──────────────────────────────────────
      const cached = getCachedMembership(address, circleId)
      if (cached) {
        console.log('[Contribute] cache hit')
        membershipInput = cached
      }

      // ── Layer 2: poll requestRecords ─────────────────────────────────────
      if (!membershipInput && requestRecords) {
        membershipInput = await pollWalletRecords(requestRecords, decrypt, circleId, setTransactionStatus)
        if (membershipInput) setCachedMembership(address, circleId, membershipInput)
      }

      // ── Layer 3: fetch record ciphertext from Aleo testnet ───────────────
      if (!membershipInput) {
        const txId = getJoinTxId(address, circleId)
        if (txId) {
          setTransactionStatus('Fetching record from Aleo testnet…')
          console.log('[Contribute] querying testnet for txId:', txId)
          const ciphertext = await fetchRecordCiphertextFromChain(txId, PROGRAM_ID)
          if (ciphertext) {
            console.log('[Contribute] got ciphertext from chain')
            membershipInput = ciphertext
            setCachedMembership(address, circleId, ciphertext)
          }
        }
      }

      if (!membershipInput) {
        throw new Error(
          'Membership record not found in your wallet.\n\n' +
          '• Make sure you joined this circle and the transaction was confirmed.\n' +
          '• Open Shield Wallet and tap "Sync" to force a record refresh, then try again.'
        )
      }

      // ── Get current cycle ────────────────────────────────────────────────
      const response = await getCircleDetail(circleId)
      const cycle = response.circle.currentCycle || 1

      setTransactionStatus('Awaiting wallet approval…')

      const result = await executeTransaction({
        program: PROGRAM_ID,
        function: 'contribute',
        inputs: [
          membershipInput,                       // membership: CircleMembership
          potAddress || DEFAULT_POT_ADDRESS,     // pot_address: address (public)
          `${cycle}u8`,                          // cycle: u8 (public)
        ],
        fee: BASE_FEE,
        privateFee: false,
      })

      const txId = String((result as any)?.transactionId || result)
      console.log('[Contribute] TX:', txId)
      setTransactionStatus('Contribution confirmed on-chain!')
      await new Promise(r => setTimeout(r, 2000))

      try {
        await recordContributionBackend({ circleId, memberAddress: address, cycle, amount, transactionId: txId })
      } catch (e) { console.warn('[Contribute] backend failed:', e) }

      setIsContributing(false)
      setTransactionStatus(null)
      return { success: true, transactionId: txId }
    } catch (error) {
      console.error('Contribute error:', error)
      setIsContributing(false)
      setTransactionStatus(null)
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
    }
  }, [connected, address, executeTransaction, requestRecords, decrypt])

  return { contribute, isContributing, transactionStatus }
}
