/**
 * ZkCircles – committed runtime configuration.
 *
 * This file is tracked by git so production builds on Render always get the
 * correct values regardless of environment variables being set in the dashboard.
 *
 * Env vars still take priority if explicitly set (useful for local overrides).
 */

// ── Deployed contract ────────────────────────────────────────────────────────
// v6 Deployment TX: at1z5rendz2gtpeq7u2ldsnmy8mrcvlxasn373n9j5j54v8t32lxcrsq7u7wh
// v7 adds: flag_missed_contribution, defaults mapping, default_flags mapping
// v8 adds: token_id in CircleInfo, stablecoin support via token_registry.aleo
// v9 adds: direct imports of test_usdcx_stablecoin.aleo + test_usad_stablecoin.aleo
//         token_id = 1field (USDCx) / 2field (USAD) — no token_registry.aleo needed
export const PROGRAM_ID =
  (import.meta.env.VITE_PROGRAM_ID as string) || 'zk_circles_v9.aleo'

// ── Backend API ──────────────────────────────────────────────────────────────
export const BACKEND_URL =
  (import.meta.env.VITE_BACKEND_URL as string) || 'https://zkcircles.onrender.com'

// ── Transaction fees (microcredits) ─────────────────────────────────────────
export const FEE_CONTRIBUTE   = 1_000_000   // 1 ALEO
export const FEE_CLAIM        = 1_000_000   // 1 ALEO
export const FEE_CREATE       = 1_000_000   // 1 ALEO
export const FEE_JOIN         = 1_000_000   // 1 ALEO
export const FEE_TRANSFER     =   500_000   // 0.5 ALEO
export const FEE_VERIFY       =   300_000   // 0.3 ALEO
export const FEE_DISPUTE      =   300_000   // 0.3 ALEO  (flag_missed_contribution)

// ── Stablecoin token support (direct program imports, v9) ────────────────────
// token_id = 0field means Aleo native credits.
// 1field = test_usdcx_stablecoin.aleo (USDCx on testnet)
// 2field = test_usad_stablecoin.aleo  (USAD on testnet)
// These are internal identifiers used inside zk_circles_v9.aleo to route
// to the correct stablecoin transition — NOT token_registry token IDs.
export const TOKEN_ID_ALEO  = '0field'
export const TOKEN_ID_USDCX = '1field'
export const TOKEN_ID_USAD  = '2field'

export interface TokenConfig {
  tokenId: string
  symbol: string
  label: string
  decimals: number
}

export const TOKENS: TokenConfig[] = [
  { tokenId: TOKEN_ID_ALEO,  symbol: 'ALEO',  label: 'Aleo Credits',       decimals: 6 },
  { tokenId: TOKEN_ID_USDCX, symbol: 'USDCx', label: 'USD Coin (Aleo)',     decimals: 6 },
  { tokenId: TOKEN_ID_USAD,  symbol: 'USAD',  label: 'Aleo Dollar (USAD)',  decimals: 6 },
]

export function getTokenConfig(tokenId: string | undefined): TokenConfig {
  return TOKENS.find(t => t.tokenId === tokenId) ?? TOKENS[0]
}
