/**
 * Query on-chain Aleo mappings via the public explorer API.
 * Used for pre-flight validation before submitting transactions.
 */

import { PROGRAM_ID } from '../config'

const API_BASE = 'https://api.explorer.provable.com/v1/testnet'

export interface OnChainCircleInfo {
  contribution_amount: number
  max_members: number
  total_cycles: number
  current_cycle: number
  members_joined: number
  status: number
}

/**
 * Query the `circles` mapping for a given circle_id.
 * Returns null if the circle doesn't exist or the API is unavailable.
 */
export async function queryCircleOnChain(circleId: string): Promise<OnChainCircleInfo | null> {
  try {
    const url = `${API_BASE}/program/${PROGRAM_ID}/mapping/circles/${circleId}`
    const res = await fetch(url, { signal: AbortSignal.timeout(10_000) })
    if (!res.ok) return null

    const raw = await res.text()
    if (!raw || raw === 'null' || raw === '""') return null

    // Parse the Aleo struct format:
    // { contribution_amount: 10000u64, max_members: 2u8, ... }
    const parseField = (name: string, suffix: string): number => {
      const regex = new RegExp(`${name}:\\s*(-?\\d+)${suffix}`)
      const m = raw.match(regex)
      return m ? parseInt(m[1], 10) : 0
    }

    return {
      contribution_amount: parseField('contribution_amount', 'u64'),
      max_members: parseField('max_members', 'u8'),
      total_cycles: parseField('total_cycles', 'u8'),
      current_cycle: parseField('current_cycle', 'u8'),
      members_joined: parseField('members_joined', 'u8'),
      status: parseField('status', 'u8'),
    }
  } catch (e) {
    console.warn('[queryCircleOnChain] Failed:', e)
    return null
  }
}

/**
 * Query the `members` mapping. Key = BHP256::hash_to_field(MemberKey{circle_id, member_addr}).
 * Since we can't compute BHP256 in the browser, we skip this for now.
 * Instead, we rely on the circles mapping which tells us enough.
 */

/**
 * Query the program's public credit balance (account mapping in credits.aleo).
 * On Aleo, the program address is deterministic from program ID.
 */
export async function queryProgramBalance(): Promise<number | null> {
  try {
    // Program addresses use a deterministic hash; we can look it up via the mapping API
    // credits.aleo mapping "account" maps address → u64
    // For now, we just check if the program is funded via a simpler method
    const url = `${API_BASE}/program/${PROGRAM_ID}`
    const res = await fetch(url, { signal: AbortSignal.timeout(8_000) })
    if (!res.ok) return null
    // We can't easily query credits.aleo/account for the program address
    // without knowing the address. Return null to indicate unknown.
    return null
  } catch {
    return null
  }
}

/**
 * Generic mapping query — fetch a single value from any mapping in our program.
 * Returns the raw string or null if the key doesn't exist.
 */
export async function queryMapping(mappingName: string, key: string): Promise<string | null> {
  try {
    const url = `${API_BASE}/program/${PROGRAM_ID}/mapping/${mappingName}/${key}`
    const res = await fetch(url, { signal: AbortSignal.timeout(10_000) })
    if (!res.ok) return null
    const raw = await res.text()
    if (!raw || raw === 'null' || raw === '""') return null
    return raw.replace(/"/g, '').trim()
  } catch {
    return null
  }
}

/**
 * Parse a numeric mapping value from the raw on-chain string.
 * Handles suffixes like u8, u16, u32, u64.
 */
export function parseMappingNumber(raw: string | null): number {
  if (!raw) return 0
  const cleaned = raw.replace(/u\d+$/, '').trim()
  return parseInt(cleaned, 10) || 0
}
