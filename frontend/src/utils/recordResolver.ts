/**
 * Shared utilities for resolving CircleMembership records into a format
 * that Shield Wallet's executeTransaction() can parse.
 *
 * Shield Wallet expects the Aleo Instructions record plaintext format:
 *   {
 *     owner: aleo1...address.private,
 *     circle_id: 123field.private,
 *     contribution_amount: 1000u64.private,
 *     _nonce: 123...456group.public
 *   }
 *
 * requestRecords() may return records with only `ciphertext` + `data` and
 * NO `recordPlaintext`. We must decrypt(ciphertext) to obtain proper plaintext.
 */

import { PROGRAM_ID } from '../config'

// ─── Type discrimination ─────────────────────────────────────────────────────

/**
 * Return true only for CircleMembership records.
 * CircleMembership has `contribution_amount` but NOT `cycle`.
 * ContributionReceipt and PayoutReceipt both have `cycle` — reject them.
 */
export function isMembershipRecord(r: any, pt?: string): boolean {
  if (r && r.data) {
    return 'contribution_amount' in r.data && !('cycle' in r.data)
  }
  if (pt) {
    return pt.includes('contribution_amount') && !/\bcycle\b/.test(pt)
  }
  // Unknown structure — conservative: only allow if the record's ciphertext /
  // plaintext string is not available AND no data object. The wallet will
  // validate on execution. We allow it to avoid incorrectly filtering valid
  // records that lack parsed data, but we tighten at the cache layer instead.
  return true
}

// ─── Circle matching ─────────────────────────────────────────────────────────

/**
 * Check if a wallet record belongs to the given circle and is a CircleMembership.
 */
export function isCircleMatch(r: any, circleId: string, bareId: string): boolean {
  // Strategy 1: parsed data object
  if (r.data?.circle_id) {
    const storedId = String(r.data.circle_id).replace('.private', '').replace('.public', '')
    if (
      storedId === circleId ||
      storedId === bareId ||
      storedId.replace(/field$/i, '') === bareId
    ) {
      return isMembershipRecord(r)
    }
  }

  // Strategy 2: plaintext string
  const pt: string | undefined = r.recordPlaintext || r.plaintext || r.record
  if (pt && typeof pt === 'string') {
    if (pt.includes(circleId) || pt.includes(bareId)) {
      return isMembershipRecord(r, pt)
    }
  }

  return false
}

// ─── Record input resolution ─────────────────────────────────────────────────

/**
 * Given a matched record, extract the best string for executeTransaction input.
 *
 * Priority:
 *  1. recordPlaintext with _nonce         — proper Aleo format, always works
 *  2. decrypt(ciphertext) → plaintext     — produces proper Aleo format
 *  3. raw ciphertext                      — last resort, may not work
 *  4. bare plaintext without _nonce       — unlikely to work
 */
export async function extractRecordInput(
  r: any,
  decrypt?: (ct: string) => Promise<any>
): Promise<string | null> {
  const pt: string | undefined = r.recordPlaintext || r.plaintext || r.record
  const ct: string | undefined = r.ciphertext || r.recordCiphertext

  // 1. Plaintext with _nonce — already the right format
  if (pt && typeof pt === 'string' && pt.includes('_nonce')) {
    return pt
  }

  // 2. Decrypt ciphertext to get proper Aleo plaintext
  if (ct && typeof ct === 'string' && ct.startsWith('record1') && decrypt) {
    try {
      const dec = await decrypt(ct)
      const decStr = typeof dec === 'string'
        ? dec
        : ((dec as any)?.text ?? String(dec))
      if (typeof decStr === 'string' && decStr.length > 10) {
        return decStr
      }
    } catch (e) {
      console.warn('[extractRecordInput] decrypt failed:', e)
    }
  }

  // 3. Raw ciphertext (Shield may or may not handle this)
  if (ct && typeof ct === 'string' && ct.startsWith('record1')) {
    return ct
  }

  // 4. Bare plaintext without _nonce (last resort)
  if (pt && typeof pt === 'string') {
    return pt
  }

  return null
}

/**
 * Resolve a cached string into a usable record input.
 * If it's a ciphertext, decrypt it first.
 */
export async function resolveCachedRecord(
  cached: string,
  decrypt?: (ct: string) => Promise<any>
): Promise<string | null> {
  // ── Guard: reject ContributionReceipt / PayoutReceipt plaintext in cache ──
  // If the cached value is a plaintext that contains "cycle" but is missing
  // "contribution_amount", it's the wrong record type. Discard it.
  if (!cached.startsWith('record1')) {
    if (/\bcycle\b/.test(cached) && !cached.includes('contribution_amount')) {
      console.warn('[resolveCachedRecord] Discarding wrong-type record (ContributionReceipt/PayoutReceipt) from cache.')
      return null
    }
  }

  // Plaintext with _nonce — ideal Aleo record format
  if (!cached.startsWith('record1') && cached.includes('_nonce')) {
    return cached
  }

  // Ciphertext — try to decrypt to get proper plaintext+nonce
  if (cached.startsWith('record1') && decrypt) {
    try {
      const dec = await decrypt(cached)
      const decStr = typeof dec === 'string'
        ? dec
        : ((dec as any)?.text ?? String(dec))
      if (typeof decStr === 'string' && decStr.length > 10) {
        // Return the decrypted string even if it has no _nonce — some wallets
        // (Shield) accept plaintext without _nonce via commitment re-derivation.
        // The wallet will reject it properly if it truly can't use it.
        return decStr
      }
    } catch {
      // Decrypt threw — return ciphertext and let the wallet try
      return cached
    }
  }

  // Ciphertext but no decrypt available — pass to wallet as-is
  if (cached.startsWith('record1')) return cached

  // Plaintext WITHOUT _nonce (Shield Wallet sometimes returns this from decrypt).
  // Use it directly — the wallet can derive the commitment from the field values.
  // Only discard obvious non-record values (plain JSON with colons/braces, etc.).
  if (cached.includes('owner') && cached.includes('contribution_amount')) {
    return cached
  }

  // Truly unrecognisable — discard
  return null
}

// ─── Polling ─────────────────────────────────────────────────────────────────

/**
 * Poll wallet records until a matching CircleMembership is found.
 * For each match, decrypts the ciphertext to get proper Aleo plaintext.
 */
export async function pollForMembershipRecord(
  requestRecords: (program: string, includePlaintext?: boolean) => Promise<any>,
  decrypt: ((ct: string) => Promise<any>) | undefined,
  circleId: string,
  onStatus: (msg: string) => void,
  tag: string = 'Poll',
  maxAttempts = 10
): Promise<string | null> {
  const bareId = circleId.replace(/field$/i, '')
  // 10 attempts: 0 + 3 + 5 + 7 + 8 + 10 + 10 + 10 + 10 + 10 = ~73 seconds total
  const delays = [0, 3000, 5000, 7000, 8000, 10000, 10000, 10000, 10000, 10000]

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    if (delays[attempt] > 0) {
      onStatus(`Waiting for wallet sync… (${attempt + 1}/${maxAttempts})`)
      await new Promise(r => setTimeout(r, delays[attempt]))
    }

    try {
      const records: any[] = (await requestRecords(PROGRAM_ID, true)) || []
      console.log(`[${tag}] requestRecords attempt ${attempt + 1}: ${records.length} records`)

      // Debug: log record shape on first attempt
      if (attempt === 0 && records.length > 0) {
        const r0 = records[0]
        console.log(`[${tag}] Record keys:`, Object.keys(r0))
        console.log(`[${tag}] record[0]:`, {
          spent: r0.spent,
          hasData: !!r0.data,
          dataKeys: r0.data ? Object.keys(r0.data) : [],
          hasCiphertext: !!(r0.ciphertext || r0.recordCiphertext),
          hasRecordPlaintext: !!r0.recordPlaintext,
          hasPlaintext: !!r0.plaintext,
          hasRecord: !!r0.record,
        })
      }

      // Only use unspent records. Using a spent record causes
      // "input ID already exists" because the record was already consumed.
      for (const r of records) {
        if (r.spent) {
          if (isCircleMatch(r, circleId, bareId)) {
            console.log(`[${tag}] Skipping SPENT record for circle ${bareId} (attempt ${attempt + 1})`)
          }
          continue
        }
        if (!isCircleMatch(r, circleId, bareId)) continue
        const input = await extractRecordInput(r, decrypt)
        if (input) {
          const fmt = input.startsWith('record1')
            ? 'ciphertext'
            : input.includes('_nonce') ? 'plaintext+nonce' : 'bare-plaintext'
          console.log(`[${tag}] Match (unspent, attempt ${attempt + 1}) [${fmt}]`)
          return input
        }
      }
    } catch (err: any) {
      console.warn(`[${tag}] attempt ${attempt + 1} error:`, err?.message)
    }
  }

  return null
}
