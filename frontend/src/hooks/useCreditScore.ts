import { useState, useCallback } from 'react'
import { useWallet } from '@provablehq/aleo-wallet-adaptor-react'
import { fetchMyCircles } from '../services/api'
import type { CircleData } from '../services/api'
// On-chain query utilities (available for future use when backend endpoint is added)
// import { queryMapping, parseMappingNumber } from '../utils/onChainQuery'
import { PROGRAM_ID, FEE_UPDATE_SCORE, FEE_CLAIM_COMPLETION } from '../config'
import { trackTransaction } from '../utils/transactionTracker'
import { isStalePermissionsError, dispatchStalePermissionsEvent } from '../utils/walletErrors'

export interface CreditScore {
  score: number           // 0–100
  grade: 'A+' | 'A' | 'B' | 'C' | 'D' | 'F' | '—'
  circlesCompleted: number
  circlesActive: number
  totalContributed: number
  onTimeRate: number      // 0–1
  missedContributions: number
  totalCycles: number
  longestStreak: number
  memberSince: string | null
}

const EMPTY_SCORE: CreditScore = {
  score: 0,
  grade: '—',
  circlesCompleted: 0,
  circlesActive: 0,
  totalContributed: 0,
  onTimeRate: 0,
  missedContributions: 0,
  totalCycles: 0,
  longestStreak: 0,
  memberSince: null,
}

function gradeFromScore(score: number): CreditScore['grade'] {
  if (score >= 95) return 'A+'
  if (score >= 85) return 'A'
  if (score >= 70) return 'B'
  if (score >= 55) return 'C'
  if (score >= 40) return 'D'
  return 'F'
}

function computeScore(circles: CircleData[], _address: string): CreditScore {
  if (!circles.length) return EMPTY_SCORE

  let completed = 0
  let active = 0
  let totalContributed = 0
  let totalCyclesParticipated = 0
  let missedContributions = 0
  let longestStreak = 0
  let currentStreak = 0
  let oldest: string | null = null

  for (const c of circles) {
    if (c.status === 2) completed++
    if (c.status === 1) active++

    const contributed = c.totalContributed || 0
    totalContributed += contributed

    // Estimate cycles contributed vs expected
    const expectedCycles = c.status === 2 ? c.totalCycles : c.currentCycle
    const contributedCycles = c.contributionAmount > 0
      ? Math.min(Math.floor(contributed / c.contributionAmount), expectedCycles)
      : 0

    totalCyclesParticipated += contributedCycles
    const missed = Math.max(0, expectedCycles - contributedCycles)
    missedContributions += missed

    if (missed === 0 && expectedCycles > 0) {
      currentStreak++
      longestStreak = Math.max(longestStreak, currentStreak)
    } else {
      currentStreak = 0
    }

    if (!oldest || new Date(c.createdAt) < new Date(oldest)) {
      oldest = c.createdAt
    }
  }

  const totalExpected = totalCyclesParticipated + missedContributions
  const onTimeRate = totalExpected > 0 ? totalCyclesParticipated / totalExpected : 0

  // Score formula:
  // 40% on-time rate
  // 25% circles completed
  // 15% participation volume (log scale, cap at 20 circles)
  // 10% streak bonus
  // 10% active participation
  const onTimeScore = onTimeRate * 40
  const completionScore = Math.min(completed / Math.max(circles.length, 1), 1) * 25
  const volumeScore = Math.min(circles.length / 20, 1) * 15
  const streakScore = Math.min(longestStreak / 10, 1) * 10
  const activeScore = active > 0 ? 10 : 0

  const score = Math.round(onTimeScore + completionScore + volumeScore + streakScore + activeScore)

  return {
    score,
    grade: gradeFromScore(score),
    circlesCompleted: completed,
    circlesActive: active,
    totalContributed,
    onTimeRate,
    missedContributions,
    totalCycles: totalCyclesParticipated,
    longestStreak,
    memberSince: oldest,
  }
}

export function useCreditScore() {
  const wallet = useWallet() as any
  const { address, executeTransaction, disconnect } = wallet
  const walletTxStatus: ((id: string) => Promise<{ status?: string; transactionId?: string }>) | undefined =
    wallet.transactionStatus
  const [creditScore, setCreditScore] = useState<CreditScore>(EMPTY_SCORE)
  const [onChainScore, setOnChainScore] = useState<number | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isPublishing, setIsPublishing] = useState(false)

  const fetchScore = useCallback(async (targetAddress?: string) => {
    const addr = targetAddress || address
    if (!addr) return EMPTY_SCORE

    setIsLoading(true)
    try {
      const [circles, chainScore] = await Promise.all([
        fetchMyCircles(addr),
        fetchOnChainScore(addr),
      ])
      const score = computeScore(circles, addr)
      setCreditScore(score)
      setOnChainScore(chainScore)
      setIsLoading(false)
      return score
    } catch {
      setIsLoading(false)
      return EMPTY_SCORE
    }
  }, [address])

  // Publish the caller's credit score on-chain (calls update_credit_score)
  const publishScore = useCallback(async (): Promise<{ success: boolean; error?: string }> => {
    if (!address || !executeTransaction) return { success: false, error: 'Wallet not connected' }

    setIsPublishing(true)
    try {
      const result = await executeTransaction({
        program: PROGRAM_ID,
        function: 'update_credit_score',
        inputs: [],
        fee: FEE_UPDATE_SCORE,
        privateFee: false,
      })
      const txId = String(result?.transactionId || result)
      const confirmation = await trackTransaction(txId, () => {}, 180_000, 6_000, walletTxStatus)

      if (confirmation.status === 'rejected') {
        setIsPublishing(false)
        return { success: false, error: 'Transaction rejected on-chain.' }
      }

      // Refresh on-chain score
      const newScore = await fetchOnChainScore(address)
      setOnChainScore(newScore)
      setIsPublishing(false)
      return { success: true }
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error'
      if (isStalePermissionsError(msg)) {
        try { await disconnect?.() } catch { /* ignore */ }
        dispatchStalePermissionsEvent()
      }
      setIsPublishing(false)
      return { success: false, error: msg }
    }
  }, [address, executeTransaction, disconnect, walletTxStatus])

  // Claim circle completion bonus on-chain
  const claimCompletion = useCallback(async (
    circleId: string,
    membershipRecord: string,
  ): Promise<{ success: boolean; error?: string }> => {
    if (!address || !executeTransaction) return { success: false, error: 'Wallet not connected' }

    try {
      const result = await executeTransaction({
        program: PROGRAM_ID,
        function: 'claim_circle_completion',
        inputs: [membershipRecord, circleId],
        fee: FEE_CLAIM_COMPLETION,
        privateFee: false,
        recordIndices: [0],
      })
      const txId = String(result?.transactionId || result)
      const confirmation = await trackTransaction(txId, () => {}, 180_000, 6_000, walletTxStatus)

      if (confirmation.status === 'rejected') {
        return { success: false, error: 'Already claimed or transaction rejected.' }
      }
      return { success: true }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
    }
  }, [address, executeTransaction, walletTxStatus])

  return {
    creditScore,
    onChainScore,
    isLoading,
    isPublishing,
    fetchScore,
    publishScore,
    claimCompletion,
  }
}

/**
 * Fetch the on-chain credit score for an address.
 * The mapping key is BHP256::hash_to_field(MemberKey{circle_id:0field, member_addr:addr}).
 * Since we can't compute BHP256 in the browser, we query via the backend or
 * fall back to the off-chain computed score.
 */
async function fetchOnChainScore(_addr: string): Promise<number | null> {
  try {
    // We can't compute BHP256 in browser, but we can try to query the
    // mapping with a pre-computed key if the backend provides it.
    // For now, return null (the off-chain score is the primary display).
    // When the backend adds a /credit-score/:address endpoint, this will
    // query that instead.
    return null
  } catch {
    return null
  }
}
