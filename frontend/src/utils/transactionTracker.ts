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

// ─── Polling loop ────────────────────────────────────────────────────────────

/**
 * Poll until the transaction is confirmed (accepted / rejected) or timeout.
 *
 * @param txId        Transaction ID (at1…)
 * @param onProgress  Callback for UI status updates
 * @param maxWaitMs   Maximum wait time (default 180 s)
 * @param pollMs      Poll interval (default 6 s)
 */
export async function trackTransaction(
  txId: string,
  onProgress?: (msg: string) => void,
  maxWaitMs = 180_000,
  pollMs = 6_000,
): Promise<TxConfirmation> {
  // Skip for mock / local-only IDs
  if (!txId || txId.startsWith('mock_') || txId.startsWith('shield_')) {
    return { status: 'accepted', txId }
  }

  const start = Date.now()
  let attempt = 0

  // Initial delay — give the network time to include the TX in a block
  onProgress?.('Transaction broadcast — waiting for block inclusion…')
  await new Promise(r => setTimeout(r, 5_000))

  while (Date.now() - start < maxWaitMs) {
    attempt++
    onProgress?.(`Confirming on-chain… (check ${attempt})`)

    const result = await checkOnce(txId)

    if (result.status === 'accepted') {
      onProgress?.('Confirmed on-chain!')
      return result
    }

    if (result.status === 'rejected') {
      onProgress?.('REJECTED on-chain')
      return result
    }

    // Still pending — wait and poll again
    await new Promise(r => setTimeout(r, pollMs))
  }

  onProgress?.('Confirmation timed out — check the Aleo explorer')
  return { status: 'timeout', txId }
}
