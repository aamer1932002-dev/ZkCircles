import { useState, useCallback } from 'react'
import { getCircleDetail as getCircleDetailApi, CircleData, MemberData } from '../services/api'

export function useCircleDetail() {
  const [circle, setCircle] = useState<CircleData | null>(null)
  const [members, setMembers] = useState<MemberData[]>([])
  const [isLoading, setIsLoading] = useState(false)

  const fetchCircleDetail = useCallback(async (circleId: string) => {
    setIsLoading(true)
    try {
      const data = await getCircleDetailApi(circleId)
      setCircle(data.circle)
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
  }
}
