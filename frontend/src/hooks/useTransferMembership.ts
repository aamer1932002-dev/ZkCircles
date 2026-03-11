import { useState, useCallback } from 'react'
import { useWallet } from '@provablehq/aleo-wallet-adaptor-react'
import {
  getCachedMembership,
  clearCachedMembership,
  synthesizeMembershipRecord,
} from '../utils/membershipCache'
import { PROGRAM_ID, FEE_TRANSFER } from '../config'
import { getCircleDetail } from '../services/api'

const BASE_FEE = FEE_TRANSFER

interface TransferResult {
  success: boolean
  transactionId?: string
  error?: string
}

function reconstructPlaintext(r: any): string {
  const raw: string | undefined = r.recordPlaintext || r.plaintext || r.record
  if (raw && typeof raw === 'string') return raw
  if (!r.data) return ''
  const fields = Object.entries(r.data as Record<string, string>)
    .map(([k, v]) => `  ${k}: ${v}`)
    .join(',\n')
  return `{\n  owner: ${r.owner},\n${fields}\n}`
}

async function pollForMembershipRecord(
  requestRecords: (program: string) => Promise<any>,
  decrypt: ((ct: string) => Promise<any>) | undefined,
  circleId: string,
  onStatus: (msg: string) => void
): Promise<string | null> {
  const bareId = circleId.replace(/field$/i, '')
  const delays = [0, 2000, 4000, 5000, 5000]

  for (let attempt = 0; attempt < 5; attempt++) {
    if (delays[attempt] > 0) {
      onStatus(`Retrying wallet records… (attempt ${attempt + 1}/5)`)
      await new Promise(r => setTimeout(r, delays[attempt]))
    }
    try {
      const records: any[] = (await requestRecords(PROGRAM_ID)) || []
      const match = (r: any) => {
        if (r.data?.circle_id) {
          const sid = String(r.data.circle_id).replace('.private', '').replace('.public', '')
          if (sid === circleId || sid === bareId || sid.replace(/field$/i, '') === bareId)
            return reconstructPlaintext(r)
        }
        const pt = r.recordPlaintext || r.plaintext || r.record
        if (pt && typeof pt === 'string' && (pt.includes(circleId) || pt.includes(bareId))) return pt
        return null
      }
      for (const r of records) { if (r.spent) continue; const f = match(r); if (f) return f }
      for (const r of records) { const f = match(r); if (f) return f }
      if (decrypt) {
        for (const r of records) {
          const ct = r.ciphertext || r.recordCiphertext
          if (!ct) continue
          try {
            const dec = await decrypt(ct)
            const s = typeof dec === 'string' ? dec : JSON.stringify(dec)
            if (s.includes(circleId) || s.includes(bareId)) return s
          } catch { /* next */ }
        }
      }
    } catch (err: any) { console.warn('[TransferMembership] attempt error:', err?.message) }
  }
  return null
}

export function useTransferMembership() {
  const { connected, address, executeTransaction, requestRecords, decrypt } = useWallet()
  const [isTransferring, setIsTransferring] = useState(false)
  const [transactionStatus, setTransactionStatus] = useState<string | null>(null)

  const transferMembership = useCallback(async (
    circleId: string,
    newOwnerAddress: string
  ): Promise<TransferResult> => {
    if (!connected || !address) return { success: false, error: 'Wallet not connected' }
    if (!executeTransaction || !requestRecords) return { success: false, error: 'Wallet does not support required features' }
    if (!newOwnerAddress.startsWith('aleo1') || newOwnerAddress.length !== 63)
      return { success: false, error: 'Invalid Aleo address format' }
    if (newOwnerAddress === address) return { success: false, error: 'Cannot transfer to yourself' }

    setIsTransferring(true)
    setTransactionStatus('Looking up your membership record…')

    try {
      let membershipPlaintext: string | null = null

      const cached = getCachedMembership(address, circleId)
      if (cached) { console.log('[TransferMembership] Using cached record'); membershipPlaintext = cached }

      if (!membershipPlaintext) {
        membershipPlaintext = await pollForMembershipRecord(requestRecords, decrypt, circleId, (msg) => setTransactionStatus(msg))
      }

      if (!membershipPlaintext) {
        // Last resort: synthesize
        let amount = 0
        try { const r = await getCircleDetail(circleId); amount = r.circle.contributionAmount } catch { /* ignore */ }
        console.warn('[TransferMembership] Using synthesized record')
        membershipPlaintext = synthesizeMembershipRecord(address, circleId, amount)
      }

      setTransactionStatus('Awaiting wallet approval…')

      const result = await executeTransaction({
        program: PROGRAM_ID,
        function: 'transfer_membership',
        inputs: [membershipPlaintext, newOwnerAddress],
        fee: BASE_FEE,
        privateFee: false,
      })

      const txId = String((result as any)?.transactionId || result)
      console.log('[TransferMembership] TX:', txId)

      // After transfer the record now belongs to the new owner — clear our cache
      clearCachedMembership(address, circleId)

      setTransactionStatus('Membership transferred!')
      await new Promise(r => setTimeout(r, 1500))
      setIsTransferring(false)
      setTransactionStatus(null)
      return { success: true, transactionId: txId }
    } catch (error) {
      console.error('[TransferMembership] Error:', error)
      setIsTransferring(false)
      setTransactionStatus(null)
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
    }
  }, [connected, address, executeTransaction, requestRecords, decrypt])

  return { transferMembership, isTransferring, transactionStatus }
}
