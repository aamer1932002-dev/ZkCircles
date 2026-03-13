import { useState, useCallback } from 'react'
import { useWallet } from '@provablehq/aleo-wallet-adaptor-react'
import {
  fetchMyCircles as fetchMyCirclesApi,
  fetchCirclesBatch,
  CircleData,
} from '../services/api'

export function useMyCircles() {
  const { address } = useWallet()
  const [circles, setCircles] = useState<CircleData[]>([])
  const [isLoading, setIsLoading] = useState(false)

  const fetchMyCircles = useCallback(async () => {
    if (!address) {
      setCircles([])
      return
    }

    setIsLoading(true)
    try {
      // Primary path: user-specific endpoint
      const data = await fetchMyCirclesApi(address)

      // If we got circle IDs back but they lack detail (e.g. status/currentCycle
      // are stale), refresh them in one batch call for fresher data.
      const ids = data.map(c => c.id).filter(Boolean)
      if (ids.length > 1) {
        const fresh = await fetchCirclesBatch(ids)
        if (fresh.length > 0) {
          const freshMap = new Map(fresh.map(c => [c.id, c]))
          const merged = data.map(c => {
            const f = freshMap.get(c.id)
            return f ? { ...c, ...f } : c
          })
          setCircles(merged)
          return
        }
      }

      setCircles(data)
    } catch (error) {
      console.error('Failed to fetch my circles:', error)
      setCircles([])
    } finally {
      setIsLoading(false)
    }
  }, [address])

  return {
    circles,
    isLoading,
    fetchMyCircles,
  }
}
