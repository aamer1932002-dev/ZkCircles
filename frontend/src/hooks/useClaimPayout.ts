import { useState, useCallback } from 'react'
import { useWallet } from '@provablehq/aleo-wallet-adaptor-react'
import { recordPayoutBackend, getCircleDetail } from '../services/api'
import {
  getCachedMembership,
  setCachedMembership,
  clearCachedMembership,
  synthesizeMembershipRecord,
} from '../utils/membershipCache'
import { PROGRAM_ID, FEE_CLAIM } from '../config'

const BASE_FEE = FEE_CLAIM

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
    const storedId = String(r.data.circle_id).replace('.private', '').replace('.public', '')
    if (storedId === circleId || storedId === bareId || storedId.replace(/field$/i, '') === bareId) {
      return reconstructPlaintext(r)
    }
  }
  const pt: string | undefined = r.recordPlaintext || r.plaintext || r.record
  if (pt && typeof pt === 'string') {
    if (pt.includes(circleId) || pt.includes(bareId)) return pt
  }
  return null
}

async function pollForMembershipRecord(
  requestRecords: (program: string) => Promise<any>,
  decrypt: ((ct: string) => Promise<any>) | undefined,
  circleId: string,
  onStatus: (msg: string) => void,
  maxAttempts = 5
): Promise<string | null> {
  const bareId = circleId.replace(/field$/i, '')
  const delays = [0, 2000, 4000, 5000, 5000]

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    if (delays[attempt] > 0) {
      onStatus(attempt === 1 ? 'Waiting for record to sync… (attempt 2/5)' : `Retrying wallet records… (attempt ${attempt + 1}/${maxAttempts})`)
      await new Promise(r => setTimeout(r, delays[attempt]))
    }
    try {
      const records: any[] = (await requestRecords(PROGRAM_ID)) || []
      console.log(`[ClaimPayout] requestRecords attempt ${attempt + 1}: ${records.length} records`)
      if (attempt === 0 && records.length > 0) console.log('[ClaimPayout] Sample record:', JSON.stringify(records[0]))

      for (const r of records) { if (r.spent) continue; const f = matchRecord(r, circleId, bareId); if (f) return f }
      for (const r of records) { const f = matchRecord(r, circleId, bareId); if (f) return f }
      if (decrypt) {
        for (const r of records) {
          const ct: string | undefined = r.ciphertext || r.recordCiphertext
          if (!ct) continue
          try { const dec = await decrypt(ct); const s = typeof dec === 'string' ? dec : JSON.stringify(dec); if (s.includes(circleId) || s.includes(bareId)) return s } catch { /* next */ }
        }
      }
    } catch (err: any) { console.warn(`[ClaimPayout] attempt ${attempt + 1} error:`, err?.message) }
  }
  return null
}

interface ClaimPayoutResult {
  success: boolean
  transactionId?: string
  amount?: number
  error?: string
}

export function useClaimPayout() {
  const { connected, address, executeTransaction, requestRecords, decrypt } = useWallet()
  const [isClaiming, setIsClaiming] = useState(false)
  const [transactionStatus, setTransactionStatus] = useState<string | null>(null)

  const claimPayout = useCallback(async (circleId: string): Promise<ClaimPayoutResult> => {
    if (!connected || !address) return { success: false, error: 'Wallet not connected' }

    setIsClaiming(true)
    setTransactionStatus('Fetching circle details…')

    try {
      const response = await getCircleDetail(circleId)
      const circle = response.circle
      const cycleNumber = circle.currentCycle || 1
      const payoutAmount = circle.contributionAmount * circle.maxMembers

      let membershipPlaintext: string | null = null
      setTransactionStatus('Looking up your membership record…')

      const cached = getCachedMembership(address, circleId)
      if (cached) { console.log('[ClaimPayout] Using cached record'); membershipPlaintext = cached }

      if (!membershipPlaintext && requestRecords) {
        membershipPlaintext = await pollForMembershipRecord(requestRecords, decrypt, circleId, (msg) => setTransactionStatus(msg))
      }

      if (membershipPlaintext) setCachedMembership(address, circleId, membershipPlaintext)

      if (!membershipPlaintext) {
        console.warn('[ClaimPayout] Using synthesized membership record')
        membershipPlaintext = synthesizeMembershipRecord(address, circleId, circle.contributionAmount)
      }

      setTransactionStatus('Awaiting wallet approval…')

      const result = await executeTransaction({
        program: PROGRAM_ID,
        function: 'claim_payout',
        inputs: [
          membershipPlaintext,
          `${cycleNumber}u8`,
        ],
        fee: BASE_FEE,
        privateFee: false,
      })

      const txId = String((result as any)?.transactionId || result)
      console.log('[ClaimPayout] TX:', txId)
      clearCachedMembership(address, circleId)

      try { await recordPayoutBackend({ circleId, memberAddress: address, cycle: cycleNumber, amount: payoutAmount, transactionId: txId }) }
      catch (e) { console.warn('[ClaimPayout] Backend failed:', e) }

      setTransactionStatus(`Payout of ${(payoutAmount / 1_000_000).toFixed(3)} ALEO claimed!`)
      await new Promise(r => setTimeout(r, 1500))
      setIsClaiming(false)
      setTransactionStatus(null)
      return { success: true, transactionId: txId, amount: payoutAmount }
    } catch (error) {
      console.error('Claim payout error:', error)
      setIsClaiming(false)
      setTransactionStatus(null)
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
    }
  }, [connected, address, executeTransaction, requestRecords, decrypt])

  return { claimPayout, isClaiming, transactionStatus }
}
