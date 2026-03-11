/**
 * ZkCircles – committed runtime configuration.
 *
 * This file is tracked by git so production builds on Render always get the
 * correct values regardless of environment variables being set in the dashboard.
 *
 * Env vars still take priority if explicitly set (useful for local overrides).
 */

// ── Deployed contract ────────────────────────────────────────────────────────
// TX: at1xdqjlu543q3j594v9ueev7lzvs6d4hd2zvd6uyajfewjlhd3gvgsmm0zwa
export const PROGRAM_ID =
  (import.meta.env.VITE_PROGRAM_ID as string) || 'zk_circles_v5.aleo'

// ── Circle pot address (collects contributions via transfer_public_as_signer) ─
export const CIRCLE_POT_ADDRESS =
  (import.meta.env.VITE_CIRCLE_POT_ADDRESS as string) ||
  'aleo1yvukv56vxntqpc280d40dhuvz4prpwzvdvjcm9ggm8a8e3tffsgqc9ws3t'

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
