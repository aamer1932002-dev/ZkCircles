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
import { isStalePermissionsError, STALE_PERMISSIONS_USER_MSG, dispatchStalePermissionsEvent } from '../utils/walletErrors'

const BASE_FEE = FEE_CLAIM

function isMembershipRecord(r: any, pt?: string): boolean {
  if (r.data) return 'contribution_amount' in r.data && !('cycle' in r.data)
  if (pt) return pt.includes('contribution_amount') && !/(\bcycle\b.*:)/.test(pt)
  return true
}

function matchRecord(r: any, circleId: string, bareId: string): string | null {
  let matched = false

  if (r.data?.circle_id) {
    const sid = String(r.data.circle_id).replace('.private', '').replace('.public', '')
    if (sid === circleId || sid === bareId || sid.replace(/field$/i, '') === bareId) {
      if (!isMembershipRecord(r)) return null
      matched = true
    }
  }

  const pt: string | undefined = r.recordPlaintext || r.plaintext || r.record
  if (!matched && pt && typeof pt === 'string' && (pt.includes(circleId) || pt.includes(bareId))) {
    if (!isMembershipRecord(r, pt)) return null
    matched = true
  }

  if (!matched) return null

  // Return the full plaintext WITH _nonce — Shield Wallet's proof engine
  // needs the plaintext field values, NOT the ciphertext.
  if (pt && typeof pt === 'string') return pt

  // Last resort: ciphertext (unlikely to work for executeTransaction)
  const ct: string | undefined = r.ciphertext || r.recordCiphertext
  if (ct && typeof ct === 'string' && ct.startsWith('record1')) return ct

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
          if (!ct || typeof ct !== 'string') continue
          try {
            const dec = await decrypt(ct)
            const s = typeof dec === 'string' ? dec : JSON.stringify(dec)
            if ((s.includes(circleId) || s.includes(bareId)) && isMembershipRecord({}, s)) return s
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
  const { connected, address, executeTransaction, requestRecords, decrypt, disconnect } = useWallet()
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

      // ── Layer 1: cache ────────────────────────────────────────────
      const cached = getCachedMembership(address, circleId)
      if (cached && cached.includes('_nonce')) {
        console.log('[ClaimPayout] cache hit')
        membershipInput = cached
      } else if (cached) {
        console.warn('[ClaimPayout] Cached record missing _nonce — ignoring, will re-fetch')
        clearCachedMembership(address, circleId)
      }

      // ── Layer 2: poll wallet ─────────────────────────────────────────────
      if (!membershipInput && requestRecords) {
        membershipInput = await pollWalletRecords(requestRecords, decrypt, circleId, setTransactionStatus)
        if (membershipInput) setCachedMembership(address, circleId, membershipInput)
      }

      // ── Layer 3: fetch ciphertext from Aleo testnet then decrypt it ────────
      if (!membershipInput) {
        const txId = getJoinTxId(address, circleId)
        if (txId) {
          setTransactionStatus('Fetching record from Aleo testnet…')
          console.log('[ClaimPayout] querying testnet for txId:', txId)
          const ciphertext = await fetchRecordCiphertextFromChain(txId, PROGRAM_ID)
          if (ciphertext && decrypt) {
            try {
              setTransactionStatus('Decrypting record…')
              const dec = await decrypt(ciphertext)
              const s = typeof dec === 'string' ? dec : JSON.stringify(dec)
              if (s && s.includes('contribution_amount')) {
                console.log('[ClaimPayout] decrypted chain record successfully')
                membershipInput = s
                setCachedMembership(address, circleId, s)
              }
            } catch (e) {
              console.warn('[ClaimPayout] failed to decrypt chain ciphertext:', e)
            }
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

      // ── Get current cycle + circle info (needed for payout amount) ────────
      const response = await getCircleDetail(circleId)
      const cycleNumber = Number(response.circle.currentCycle) || 1
      // payout = every member's contribution for one cycle
      const contributionAmount = Number(response.circle.contributionAmount) || 0
      const maxMembers = Number(response.circle.maxMembers) || 0
      const payoutAmount = contributionAmount * maxMembers
      if (payoutAmount <= 0) {
        throw new Error('Could not determine payout amount from circle details.')
      }

      setTransactionStatus('Awaiting wallet approval…')

      const result = await executeTransaction({
        program: PROGRAM_ID,
        function: 'claim_payout',
        inputs: [
          membershipInput,          // membership: CircleMembership
          `${cycleNumber}u8`,       // cycle: u8 (public)
          `${payoutAmount}u64`,     // payout_amount: u64 (public) — verified on-chain
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
      const msg = error instanceof Error ? error.message : 'Unknown error'
      if (isStalePermissionsError(msg)) {
        try { await disconnect?.() } catch { /* ignore */ }
        dispatchStalePermissionsEvent()
        setIsClaiming(false)
        setTransactionStatus(null)
        return { success: false, error: STALE_PERMISSIONS_USER_MSG }
      }
      console.error('ClaimPayout error:', error)
      setIsClaiming(false)
      setTransactionStatus(null)
      return { success: false, error: msg }
    }
  }, [connected, address, executeTransaction, requestRecords, decrypt])

  return { claimPayout, isClaiming, transactionStatus }
}
