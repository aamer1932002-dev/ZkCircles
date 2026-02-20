import { useState, useCallback } from 'react'
import { useWallet } from '@provablehq/aleo-wallet-adaptor-react'
import { fetchMyCircles as fetchMyCirclesApi, CircleData } from '../services/api'

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
      const data = await fetchMyCirclesApi(address)
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
