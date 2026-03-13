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
// v8 adds: token_id in CircleInfo, contribute_token + claim_payout_token via token_registry.aleo
// Switch PROGRAM_ID to zk_circles_v8.aleo after deploying v8 to testnet
export const PROGRAM_ID =
  (import.meta.env.VITE_PROGRAM_ID as string) || 'zk_circles_v6.aleo'

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

// ── ARC-20 token support (token_registry.aleo) ───────────────────────────────
// token_id = 0field means Aleo native credits (no token_registry involved).
// Non-zero token_ids refer to ARC-20 tokens registered in token_registry.aleo.
//
// To find the correct token_ids on testnet, query the registry:
//   snarkos developer execute token_registry.aleo get_token <token_id> \
//     --network testnet --query https://api.explorer.provable.com/v1/testnet
//
// TODO: Replace placeholders with real testnet token_ids once USDCx and USAD
// are registered in token_registry.aleo on Aleo testnet.
export const TOKEN_ID_ALEO = '0field'

// USDCx — USD Coin bridged to Aleo via token_registry.aleo
// Placeholder: replace with the actual field value from the testnet registry
export const TOKEN_ID_USDCX =
  (import.meta.env.VITE_TOKEN_ID_USDCX as string) ||
  '1802841263955688986023655779576721959822049547892688199453139491737961494028field'

// USAD — Aleo Dollar (native Aleo stablecoin)
// Placeholder: replace with the actual field value from the testnet registry
export const TOKEN_ID_USAD =
  (import.meta.env.VITE_TOKEN_ID_USAD as string) ||
  '5017931364024986665536979104547285897176750716960040578455898820580049988403field'

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
