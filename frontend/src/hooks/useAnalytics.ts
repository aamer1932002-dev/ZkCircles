import { useState, useCallback } from 'react'
import { getCircleDetail } from '../services/api'

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001'

export interface CycleDataPoint {
  cycle: number
  label: string
  totalContributed: number
  expectedAmount: number
  completionRate: number
}

export interface MemberContributionData {
  address: string
  shortAddress: string
  totalContributed: number
  cycles: boolean[]
  hasReceivedPayout: boolean
}

export interface PayoutScheduleItem {
  cycle: number
  recipientOrder: number
  expectedBlock: number
  estimatedDate: string
  amount: number
  status: 'completed' | 'current' | 'upcoming'
}

export interface CircleAnalytics {
  circleId: string
  circleName: string
  totalMembers: number
  completedCycles: number
  totalCycles: number
  healthScore: number
  totalVolumeContributed: number
  totalVolumePaid: number
  cycleData: CycleDataPoint[]
  memberContributions: MemberContributionData[]
  payoutSchedule: PayoutScheduleItem[]
}

export function useAnalytics() {
  const [analytics, setAnalytics] = useState<CircleAnalytics | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchAnalytics = useCallback(async (circleId: string) => {
    setIsLoading(true)
    setError(null)

    try {
      // Try dedicated analytics endpoint first
      let backendAnalytics: CircleAnalytics | null = null
      try {
        const res = await fetch(`${BACKEND_URL}/api/circles/${circleId}/analytics`)
        if (res.ok) {
          backendAnalytics = await res.json()
        }
      } catch {}

      if (backendAnalytics) {
        setAnalytics(backendAnalytics)
        return
      }

      // Build from circle detail as fallback
      const { circle, members } = await getCircleDetail(circleId)
      const totalCycles = circle.maxMembers
      const currentCycle = circle.currentCycle || 0
      const contributionAmount = circle.contributionAmount
      const potAmount = contributionAmount * circle.maxMembers

      // Build cycle data
      const cycleData: CycleDataPoint[] = Array.from({ length: totalCycles }, (_, i) => {
        const cycle = i + 1
        const isComplete = cycle < currentCycle
        const isCurrent = cycle === currentCycle
        return {
          cycle,
          label: `Cycle ${cycle}`,
          totalContributed: isComplete
            ? potAmount
            : isCurrent
            ? members.reduce((sum, m) => sum + (m.totalContributed || 0), 0)
            : 0,
          expectedAmount: potAmount,
          completionRate: isComplete ? 100 : isCurrent
            ? Math.round((members.filter(m => (m.totalContributed || 0) >= contributionAmount * cycle).length / Math.max(members.length, 1)) * 100)
            : 0,
        }
      })

      // Build member contribution data
      const memberContributions: MemberContributionData[] = members.map(m => ({
        address: m.address,
        shortAddress: `${m.address.slice(0, 8)}...${m.address.slice(-6)}`,
        totalContributed: m.totalContributed || 0,
        cycles: Array.from({ length: totalCycles }, (_, i) =>
          (m.totalContributed || 0) >= contributionAmount * (i + 1)
        ),
        hasReceivedPayout: m.hasReceivedPayout,
      }))

      // Build payout schedule
      const startBlock = circle.startBlock || 0
      const blocksPerCycle = circle.cycleDurationBlocks
      const blocksPerDay = 86400 / 5 // ~5 sec block time on Aleo
      const payoutSchedule: PayoutScheduleItem[] = Array.from({ length: totalCycles }, (_, i) => {
        const cycle = i + 1
        const expectedBlock = startBlock + blocksPerCycle * cycle
        const blocksFromNow = expectedBlock - startBlock - blocksPerCycle * currentCycle
        const daysFromNow = blocksFromNow / blocksPerDay
        const date = new Date()
        date.setDate(date.getDate() + daysFromNow)
        return {
          cycle,
          recipientOrder: cycle,
          expectedBlock,
          estimatedDate: startBlock === 0 ? 'TBD' : date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
          amount: potAmount,
          status: (cycle < currentCycle ? 'completed' : cycle === currentCycle ? 'current' : 'upcoming') as 'completed' | 'current' | 'upcoming',
        }
      })

      const totalVolumeContributed = members.reduce((sum, m) => sum + (m.totalContributed || 0), 0)
      const completedMembers = members.filter(m => m.hasReceivedPayout).length
      const healthScore = members.length === 0
        ? 0
        : Math.round((totalVolumeContributed / Math.max(potAmount * Math.max(currentCycle - 1, 0), 1)) * 100)

      setAnalytics({
        circleId,
        circleName: circle.name || `Circle ${circleId.slice(0, 8)}`,
        totalMembers: members.length,
        completedCycles: Math.max(currentCycle - 1, 0),
        totalCycles,
        healthScore: Math.min(healthScore, 100),
        totalVolumeContributed,
        totalVolumePaid: completedMembers * potAmount,
        cycleData,
        memberContributions,
        payoutSchedule,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load analytics')
    } finally {
      setIsLoading(false)
    }
  }, [])

  return { analytics, isLoading, error, fetchAnalytics }
}
