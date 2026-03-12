import { useState, useCallback } from 'react'
import { getCircleDetail as getCircleDetailApi, CircleData, MemberData } from '../services/api'
import { queryCircleOnChain } from '../utils/onChainQuery'

export type OnChainSyncStatus = 'synced' | 'syncing' | 'unavailable' | null

export function useCircleDetail() {
  const [circle, setCircle] = useState<CircleData | null>(null)
  const [members, setMembers] = useState<MemberData[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [onChainStatus, setOnChainStatus] = useState<OnChainSyncStatus>(null)

  const fetchCircleDetail = useCallback(async (circleId: string) => {
    setIsLoading(true)
    setOnChainStatus(null)
    try {
      // 1. Fetch from backend (member list, names, etc.)
      const data = await getCircleDetailApi(circleId)

      // 2. Query on-chain circles mapping for authoritative state
      setOnChainStatus('syncing')
      const onChain = await queryCircleOnChain(circleId)

      if (onChain) {
        // Merge: on-chain truth overrides backend for key fields
        setCircle({
          ...data.circle,
          status: onChain.status,
          currentCycle: onChain.current_cycle,
          membersJoined: onChain.members_joined,
          contributionAmount: onChain.contribution_amount,
          maxMembers: onChain.max_members,
          totalCycles: onChain.total_cycles,
        })
        setOnChainStatus('synced')
        console.log('[CircleDetail] On-chain merge applied:', onChain)
      } else {
        // On-chain unavailable — use backend data only
        setCircle(data.circle)
        setOnChainStatus('unavailable')
        console.warn('[CircleDetail] On-chain query failed, using backend only')
      }

      setMembers(data.members)
    } catch (error) {
      console.error('Failed to fetch circle detail:', error)
      setCircle(null)
      setMembers([])
    } finally {
      setIsLoading(false)
    }
  }, [])

  return {
    circle,
    members,
    isLoading,
    fetchCircleDetail,
    onChainStatus,
  }
}
