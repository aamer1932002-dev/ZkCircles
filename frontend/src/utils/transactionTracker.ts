/**
 * Track transaction status on the Aleo blockchain.
 *
 * After executeTransaction() returns a txId, the transaction has been broadcast
 * but not yet confirmed. The finalize phase runs on-chain and can REJECT the TX
 * (e.g. failed assertions). This module polls the explorer API until the TX is
 * confirmed (accepted or rejected) or a timeout is reached.
 *
 * Accepted  → execution.transitions[] present in the API response
 * Rejected  → fee charged but execution absent / type === 'rejected'
 * Pending   → 404 or not yet in any block
 */

const PROVABLE_API = 'https://api.explorer.provable.com/v1/testnet'
const ALEO_API = 'https://api.explorer.aleo.org/v1/testnet'

// ─── Types ───────────────────────────────────────────────────────────────────

export type TxConfirmationStatus = 'accepted' | 'rejected' | 'pending' | 'timeout'

export interface TxConfirmation {
  status: TxConfirmationStatus
  txId: string
  /** Record ciphertexts extracted from accepted transactions. */
  recordOutputs?: string[]
  /** Human-readable reason for rejection. */
  rejectionReason?: string
}

// ─── Single-shot check ──────────────────────────────────────────────────────

async function fetchJson(url: string, timeoutMs = 10_000): Promise<any | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) })
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  }
}

function interpretResponse(txId: string, data: any): TxConfirmation {
  if (!data) return { status: 'pending', txId }

  console.log('[TxTracker] Response keys:', Object.keys(data), 'type:', data?.type)

  // ── Accepted: has execution with at least one transition ─────────────
  if (data?.execution?.transitions?.length > 0) {
    const records: string[] = []
    for (const t of data.execution.transitions) {
      for (const o of t?.outputs ?? []) {
        if (o.type === 'record' && o.value) {
          records.push(o.value)
        }
      }
    }
    return { status: 'accepted', txId, recordOutputs: records }
  }

  // ── Rejected: various indicators ─────────────────────────────────────
  if (data?.type === 'rejected' || data?.status === 'rejected') {
    return {
      status: 'rejected',
      txId,
      rejectionReason: extractRejectionReason(data),
    }
  }

  // Fee present but no successful execution → finalize failed
  if (data?.fee && (!data?.execution || data?.execution?.transitions?.length === 0)) {
    return {
      status: 'rejected',
      txId,
      rejectionReason: extractRejectionReason(data),
    }
  }

  // Response exists but can't categorise — treat as still pending
  return { status: 'pending', txId }
}

function extractRejectionReason(data: any): string {
  if (data?.rejected?.reason) return data.rejected.reason
  if (typeof data?.error === 'string') return data.error
  return (
    'Finalize assertions failed on-chain. ' +
    'Common causes: wrong cycle number, incorrect payout amount, ' +
    'not your turn to claim, circle not active, or insufficient program balance.'
  )
}

async function checkOnce(txId: string): Promise<TxConfirmation> {
  // Try provable explorer (primary)
  const provable = await fetchJson(`${PROVABLE_API}/transaction/${txId}`)
  if (provable) {
    const result = interpretResponse(txId, provable)
    if (result.status !== 'pending') return result
  }

  // Fallback: aleo.org explorer
  const aleo = await fetchJson(`${ALEO_API}/transaction/${txId}`)
  if (aleo) {
    const result = interpretResponse(txId, aleo)
    if (result.status !== 'pending') return result
  }

  return { status: 'pending', txId }
}

// ─── Shield Wallet ID resolution ─────────────────────────────────────────────

/**
 * Signature of the wallet adapter's transactionStatus function.
 * Shield Wallet exposes this on the useWallet() hook return value.
 */
type WalletStatusFn = (tempId: string) => Promise<{
  status?: string
  transactionId?: string
  error?: string
}>

/**
 * Shield Wallet's executeTransaction() returns a temporary "shield_…" ID.
 * Poll the wallet adapter until it provides the real on-chain "at1…" TX ID.
 * Returns null if the wallet reports failure or the timeout is exceeded.
 */
async function resolveShieldId(
  shieldId: string,
  walletGetStatus: WalletStatusFn,
  timeoutMs = 90_000,
): Promise<string | null> {
  const start = Date.now()
  let poll = 0
  while (Date.now() - start < timeoutMs) {
    poll++
    try {
      const r = await walletGetStatus(shieldId)
      console.log(`[TxTracker] resolveShieldId attempt ${poll}:`, r)
      if (r?.transactionId && !r.transactionId.startsWith('shield_')) {
        return r.transactionId // real at1… on-chain ID
      }
      if (r?.status === 'failed' || r?.status === 'rejected' || r?.error) {
        console.warn('[TxTracker] Wallet reports failure for shield_ ID:', r)
        return null
      }
    } catch (e) {
      console.warn('[TxTracker] resolveShieldId poll error:', e)
    }
    await new Promise(r => setTimeout(r, 3_000))
  }
  console.warn('[TxTracker] Timed out resolving shield_ ID:', shieldId)
  return null
}

// ─── Polling loop ────────────────────────────────────────────────────────────

/**
 * Poll until the transaction is confirmed (accepted / rejected) or timeout.
 *
 * @param txId              Transaction ID — either a real "at1…" or a Shield Wallet "shield_…" temp ID
 * @param onProgress        Callback for UI status updates
 * @param maxWaitMs         Maximum wait time (default 180 s)
 * @param pollMs            Poll interval (default 6 s)
 * @param walletGetStatus   Optional wallet adapter transactionStatus() function.
 *                          Required when txId is a "shield_…" temp ID so we can
 *                          resolve it to the real on-chain "at1…" ID before polling.
 */
export async function trackTransaction(
  txId: string,
  onProgress?: (msg: string) => void,
  maxWaitMs = 180_000,
  pollMs = 6_000,
  walletGetStatus?: WalletStatusFn,
): Promise<TxConfirmation> {
  // Skip for mock / local-only IDs only
  if (!txId || txId.startsWith('mock_')) {
    return { status: 'accepted', txId }
  }

  // Shield Wallet temporary ID — resolve to real at1… on-chain ID first
  let realTxId = txId
  if (txId.startsWith('shield_')) {
    if (!walletGetStatus) {
      // walletGetStatus not provided — old assumed-accepted fallback (no record outputs)
      console.warn('[TxTracker] shield_ ID received but walletGetStatus not provided. Record outputs unavailable.')
      return { status: 'accepted', txId }
    }
    onProgress?.('Waiting for wallet to broadcast transaction…')
    console.log('[TxTracker] Resolving shield_ temp ID:', txId)
    const resolved = await resolveShieldId(txId, walletGetStatus, Math.min(maxWaitMs, 90_000))
    if (!resolved) {
      onProgress?.('Could not confirm — wallet did not return on-chain TX ID')
      return { status: 'timeout', txId }
    }
    realTxId = resolved
    console.log('[TxTracker] Resolved to real TX ID:', realTxId)
    onProgress?.('Transaction broadcast — waiting for block inclusion…')
  } else {
    onProgress?.('Transaction broadcast — waiting for block inclusion…')
  }

  const start = Date.now()
  let attempt = 0

  // Initial delay — give the network time to include the TX in a block
  await new Promise(r => setTimeout(r, 5_000))

  while (Date.now() - start < maxWaitMs) {
    attempt++
    onProgress?.(`Confirming on-chain… (check ${attempt})`)

    const result = await checkOnce(realTxId)

    if (result.status === 'accepted') {
      onProgress?.('Confirmed on-chain!')
      return { ...result, txId: realTxId }
    }

    if (result.status === 'rejected') {
      onProgress?.('REJECTED on-chain')
      return { ...result, txId: realTxId }
    }

    // Still pending — wait and poll again
    await new Promise(r => setTimeout(r, pollMs))
  }

  onProgress?.('Confirmation timed out — check the Aleo explorer')
  return { status: 'timeout', txId: realTxId }
}
