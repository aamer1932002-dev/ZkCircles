import { useState, useCallback } from 'react'
import { fetchCircles as fetchCirclesApi, CircleData, CircleStats } from '../services/api'

interface UseCirclesOptions {
  status?: string
  limit?: number
}

export function useCircles() {
  const [circles, setCircles] = useState<CircleData[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [stats, setStats] = useState<CircleStats>({
    totalCircles: 0,
    activeMembers: 0,
    totalVolume: 0,
    completedCircles: 0,
  })

  const fetchCircles = useCallback(async (options: UseCirclesOptions = {}) => {
    setIsLoading(true)
    try {
      const data = await fetchCirclesApi(options)
      setCircles(data.circles)
      setStats(data.stats)
    } catch (error) {
      console.error('Failed to fetch circles:', error)
      setCircles([])
    } finally {
      setIsLoading(false)
    }
  }, [])

  return {
    circles,
    isLoading,
    stats,
    fetchCircles,
  }
}
