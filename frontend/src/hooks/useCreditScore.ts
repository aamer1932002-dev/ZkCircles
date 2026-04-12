import { useState, useCallback } from 'react'
import { useWallet } from '@provablehq/aleo-wallet-adaptor-react'
import { fetchMyCircles } from '../services/api'
import type { CircleData } from '../services/api'

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
  const { address } = wallet
  const [creditScore, setCreditScore] = useState<CreditScore>(EMPTY_SCORE)
  const [isLoading, setIsLoading] = useState(false)

  const fetchScore = useCallback(async (targetAddress?: string) => {
    const addr = targetAddress || address
    if (!addr) return EMPTY_SCORE

    setIsLoading(true)
    try {
      const circles = await fetchMyCircles(addr)
      const score = computeScore(circles, addr)
      setCreditScore(score)
      setIsLoading(false)
      return score
    } catch {
      setIsLoading(false)
      return EMPTY_SCORE
    }
  }, [address])

  return {
    creditScore,
    isLoading,
    fetchScore,
  }
}
