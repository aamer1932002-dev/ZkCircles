import { useState, useCallback } from 'react'
import { useWallet } from '@provablehq/aleo-wallet-adaptor-react'
import { recordPayoutBackend, getCircleDetail } from '../services/api'
import {
  getCachedMembership,
  setCachedMembership,
  clearCachedMembership,
  getJoinTxId,
  fetchRecordCiphertextFromChain,
} from '../utils/membershipCache'
import { PROGRAM_ID, FEE_CLAIM } from '../config'

const BASE_FEE = FEE_CLAIM

function reconstructMembershipPlaintext(r: any): string {
  const raw: string | undefined = r.recordPlaintext || r.plaintext || r.record
  if (raw && typeof raw === 'string') return raw
  if (!r.data) return ''
  // Fields in Leo struct declaration order: owner, circle_id, contribution_amount
  const owner = r.owner ? `${r.owner}.private` : (r.data.owner || '')
  const circleId = r.data.circle_id || ''
  const contribAmt = r.data.contribution_amount || ''
  return `{\n  owner: ${owner},\n  circle_id: ${circleId},\n  contribution_amount: ${contribAmt}\n}`
}

function isMembershipRecord(r: any, pt?: string): boolean {
  if (r.data) return 'contribution_amount' in r.data && !('cycle' in r.data)
  if (pt) return pt.includes('contribution_amount') && !/(\bcycle\b.*:)/.test(pt)
  return true
}

function matchRecord(r: any, circleId: string, bareId: string): string | null {
  if (r.data?.circle_id) {
    const sid = String(r.data.circle_id).replace('.private', '').replace('.public', '')
    if (sid === circleId || sid === bareId || sid.replace(/field$/i, '') === bareId) {
      if (!isMembershipRecord(r)) return null
      return reconstructMembershipPlaintext(r)
    }
  }
  const pt: string | undefined = r.recordPlaintext || r.plaintext || r.record
  if (pt && typeof pt === 'string' && (pt.includes(circleId) || pt.includes(bareId))) {
    if (!isMembershipRecord(r, pt)) return null
    return pt
  }
  return null
}

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
      onStatus(`Waiting for wallet sync… (${i + 1}/5)`)
      await new Promise(r => setTimeout(r, delays[i]))
    }
    try {
      const records: any[] = (await (requestRecords as any)(PROGRAM_ID, true)) || []
      console.log(`[ClaimPayout] wallet poll ${i + 1}: ${records.length} records`)

      for (const r of records) { if (r.spent) continue; const f = matchRecord(r, circleId, bareId); if (f) return f }
      for (const r of records) { const f = matchRecord(r, circleId, bareId); if (f) return f }
      if (decrypt) {
        for (const r of records) {
          const ct = r.ciphertext || r.recordCiphertext
          if (!ct) continue
          if (typeof ct === 'string' && ct.startsWith('record1')) return ct
          try {
            const dec = await decrypt(ct)
            const s = typeof dec === 'string' ? dec : JSON.stringify(dec)
            if (s.includes(circleId) || s.includes(bareId)) return s
          } catch { /* next */ }
        }
      }
    } catch (err: any) {
      console.warn(`[ClaimPayout] wallet poll ${i + 1} error:`, err?.message)
    }
  }
  return null
}

interface ClaimResult {
  success: boolean
  transactionId?: string
  error?: string
}

export function useClaimPayout() {
  const { connected, address, executeTransaction, requestRecords, decrypt } = useWallet()
  const [isClaiming, setIsClaiming] = useState(false)
  const [transactionStatus, setTransactionStatus] = useState<string | null>(null)

  const claimPayout = useCallback(async (
    circleId: string
  ): Promise<ClaimResult> => {
    if (!connected || !address) return { success: false, error: 'Wallet not connected' }
    if (!executeTransaction || !requestRecords) return { success: false, error: 'Wallet does not support required features' }

    setIsClaiming(true)
    setTransactionStatus('Looking up your membership record…')

    try {
      let membershipInput: string | null = null

      // ── Layer 1: cache ───────────────────────────────────────────────────
      const cached = getCachedMembership(address, circleId)
      if (cached) {
        console.log('[ClaimPayout] cache hit')
        membershipInput = cached
      }

      // ── Layer 2: poll wallet ─────────────────────────────────────────────
      if (!membershipInput && requestRecords) {
        membershipInput = await pollWalletRecords(requestRecords, decrypt, circleId, setTransactionStatus)
        if (membershipInput) setCachedMembership(address, circleId, membershipInput)
      }

      // ── Layer 3: fetch ciphertext from Aleo testnet ──────────────────────
      if (!membershipInput) {
        const txId = getJoinTxId(address, circleId)
        if (txId) {
          setTransactionStatus('Fetching record from Aleo testnet…')
          console.log('[ClaimPayout] querying testnet for txId:', txId)
          const ciphertext = await fetchRecordCiphertextFromChain(txId, PROGRAM_ID)
          if (ciphertext) {
            console.log('[ClaimPayout] got ciphertext from chain')
            membershipInput = ciphertext
            setCachedMembership(address, circleId, ciphertext)
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

      // ── Get current cycle ────────────────────────────────────────────────
      const response = await getCircleDetail(circleId)
      const cycleNumber = Number(response.circle.currentCycle) || 1

      setTransactionStatus('Awaiting wallet approval…')

      const result = await executeTransaction({
        program: PROGRAM_ID,
        function: 'claim_payout',
        inputs: [
          membershipInput,       // membership: CircleMembership
          `${cycleNumber}u8`,    // cycle: u8 (public)
        ],
        fee: BASE_FEE,
        privateFee: false,
      })

      const txId = String((result as any)?.transactionId || result)
      console.log('[ClaimPayout] TX:', txId)
      setTransactionStatus('Payout claimed!')
      await new Promise(r => setTimeout(r, 2000))

      // Membership is consumed by claim_payout — evict the stale cache
      clearCachedMembership(address, circleId)

      try {
        await recordPayoutBackend({ circleId, memberAddress: address, cycle: cycleNumber, amount: 0, transactionId: txId })
      } catch (e) { console.warn('[ClaimPayout] backend failed:', e) }

      setIsClaiming(false)
      setTransactionStatus(null)
      return { success: true, transactionId: txId }
    } catch (error) {
      console.error('ClaimPayout error:', error)
      setIsClaiming(false)
      setTransactionStatus(null)
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
    }
  }, [connected, address, executeTransaction, requestRecords, decrypt])

  return { claimPayout, isClaiming, transactionStatus }
}
