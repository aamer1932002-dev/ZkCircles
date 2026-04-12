import { useState, useCallback, useEffect } from 'react'
import { useWallet } from '@provablehq/aleo-wallet-adaptor-react'
import { fetchSchedules, saveSchedule, deleteSchedule } from '../services/api'
import type { ScheduleData } from '../services/api'

// ── localStorage fallback for when the backend is unreachable ──
const STORAGE_KEY = 'zkcircles_auto_schedules'

function getLocalSchedules(address: string): ScheduleData[] {
  try {
    const raw = localStorage.getItem(`${STORAGE_KEY}_${address}`)
    return raw ? JSON.parse(raw) : []
  } catch { return [] }
}

function setLocalSchedules(address: string, schedules: ScheduleData[]) {
  localStorage.setItem(`${STORAGE_KEY}_${address}`, JSON.stringify(schedules))
}

export function useAutoContribution() {
  const wallet = useWallet() as any
  const { connected, address } = wallet
  const [schedules, setSchedules] = useState<ScheduleData[]>([])
  const [isLoading, setIsLoading] = useState(false)

  const loadSchedules = useCallback(async () => {
    if (!address) return
    setIsLoading(true)
    try {
      const data = await fetchSchedules(address)
      if (data.length > 0) {
        setSchedules(data)
        setIsLoading(false)
        return
      }
    } catch { /* backend unreachable, fall through */ }
    // Fallback to localStorage
    setSchedules(getLocalSchedules(address))
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

    // Try backend first
    const result = await saveSchedule({
      circleId,
      memberAddress: address,
      enabled: true,
      notifyBeforeMinutes,
    })

    if (!result.success) {
      // Fallback: save to localStorage
      const local = getLocalSchedules(address)
      const idx = local.findIndex(s => s.circleId === circleId)
      const entry: ScheduleData = {
        circleId,
        enabled: true,
        notifyBeforeMinutes,
        lastNotifiedCycle: 0,
      }
      if (idx >= 0) { local[idx] = entry } else { local.push(entry) }
      setLocalSchedules(address, local)
    }

    await loadSchedules()
    return { success: true }
  }, [address, loadSchedules])

  const disableAutoContribution = useCallback(async (
    circleId: string,
  ): Promise<void> => {
    if (!address) return

    // Try backend
    await deleteSchedule(circleId, address)

    // Also remove from localStorage
    const local = getLocalSchedules(address)
    setLocalSchedules(address, local.filter(s => s.circleId !== circleId))

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
