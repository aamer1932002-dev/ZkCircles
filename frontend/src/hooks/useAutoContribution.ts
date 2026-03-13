import { useState, useCallback, useEffect } from 'react'
import { useWallet } from '@provablehq/aleo-wallet-adaptor-react'
import { fetchSchedules, saveSchedule, deleteSchedule } from '../services/api'
import type { ScheduleData } from '../services/api'

export function useAutoContribution() {
  const wallet = useWallet() as any
  const { connected, address } = wallet
  const [schedules, setSchedules] = useState<ScheduleData[]>([])
  const [isLoading, setIsLoading] = useState(false)

  const loadSchedules = useCallback(async () => {
    if (!address) return
    setIsLoading(true)
    const data = await fetchSchedules(address)
    setSchedules(data)
    setIsLoading(false)
  }, [address])

  useEffect(() => {
    if (connected && address) loadSchedules()
  }, [connected, address, loadSchedules])

  const enableAutoContribution = useCallback(async (
    circleId: string,
    notifyBeforeMinutes = 60,
  ): Promise<{ success: boolean }> => {
    if (!address) return { success: false }
    const result = await saveSchedule({
      circleId,
      memberAddress: address,
      enabled: true,
      notifyBeforeMinutes,
    })
    if (result.success) {
      await loadSchedules()
      // Register for push notifications if supported
      registerPushNotifications()
    }
    return result
  }, [address, loadSchedules])

  const disableAutoContribution = useCallback(async (
    circleId: string,
  ): Promise<void> => {
    if (!address) return
    await deleteSchedule(circleId, address)
    await loadSchedules()
  }, [address, loadSchedules])

  const isScheduled = useCallback((circleId: string): boolean => {
    return schedules.some(s => s.circleId === circleId && s.enabled)
  }, [schedules])

  const getSchedule = useCallback((circleId: string): ScheduleData | undefined => {
    return schedules.find(s => s.circleId === circleId)
  }, [schedules])

  return {
    schedules,
    isLoading,
    enableAutoContribution,
    disableAutoContribution,
    isScheduled,
    getSchedule,
    refreshSchedules: loadSchedules,
  }
}

function registerPushNotifications() {
  if (!('serviceWorker' in navigator) || !('Notification' in window)) return

  if (Notification.permission === 'default') {
    Notification.requestPermission()
  }
}
