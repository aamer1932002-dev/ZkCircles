import { useState, useCallback, useEffect } from 'react'

const PREFS_KEY = 'zkcircles_notification_prefs'

interface NotificationPrefs {
  browserEnabled: boolean
  emailEnabled: boolean
  email: string
  enabledCircles: string[]
  remindHoursBefore: number
}

const defaultPrefs: NotificationPrefs = {
  browserEnabled: false,
  emailEnabled: false,
  email: '',
  enabledCircles: [],
  remindHoursBefore: 24,
}

export function useNotifications() {
  const [prefs, setPrefs] = useState<NotificationPrefs>(defaultPrefs)
  const [permission, setPermission] = useState<NotificationPermission>('default')

  useEffect(() => {
    // Load saved prefs
    try {
      const saved = localStorage.getItem(PREFS_KEY)
      if (saved) setPrefs({ ...defaultPrefs, ...JSON.parse(saved) })
    } catch {}
    // Check permission
    if ('Notification' in window) {
      setPermission(Notification.permission)
    }
  }, [])

  const savePrefs = useCallback((updates: Partial<NotificationPrefs>) => {
    setPrefs(prev => {
      const next = { ...prev, ...updates }
      localStorage.setItem(PREFS_KEY, JSON.stringify(next))
      return next
    })
  }, [])

  const requestBrowserPermission = useCallback(async (): Promise<boolean> => {
    if (!('Notification' in window)) {
      return false
    }
    const result = await Notification.requestPermission()
    setPermission(result)
    if (result === 'granted') {
      savePrefs({ browserEnabled: true })
      return true
    }
    return false
  }, [savePrefs])

  const sendBrowserNotification = useCallback((title: string, body: string, options?: NotificationOptions) => {
    if (permission !== 'granted') return
    try {
      new Notification(title, {
        body,
        icon: '/logo.png',
        badge: '/logo.png',
        ...options,
      })
    } catch {}
  }, [permission])

  const notifyPayoutTurn = useCallback((circleName: string, amount: number) => {
    sendBrowserNotification(
      '🎉 It\'s Your Payout Turn!',
      `You are next to receive ${(amount / 1_000_000).toFixed(2)} ALEO from ${circleName}. Claim now!`,
    )
  }, [sendBrowserNotification])

  const notifyContributionDue = useCallback((circleName: string, amount: number, hoursLeft: number) => {
    sendBrowserNotification(
      '⏰ Contribution Due Soon',
      `Your ${(amount / 1_000_000).toFixed(2)} ALEO contribution to ${circleName} is due in ${hoursLeft}h.`,
    )
  }, [sendBrowserNotification])

  const notifyCircleFull = useCallback((circleName: string) => {
    sendBrowserNotification(
      '🚀 Circle Is Full!',
      `${circleName} is now full. The savings cycle has begun!`,
    )
  }, [sendBrowserNotification])

  const toggleCircleNotifications = useCallback((circleId: string, enabled: boolean) => {
    setPrefs(prev => {
      const set = new Set(prev.enabledCircles)
      if (enabled) set.add(circleId)
      else set.delete(circleId)
      const next = { ...prev, enabledCircles: Array.from(set) }
      localStorage.setItem(PREFS_KEY, JSON.stringify(next))
      return next
    })
  }, [])

  const isCircleEnabled = useCallback((circleId: string) => {
    return prefs.enabledCircles.includes(circleId)
  }, [prefs.enabledCircles])

  return {
    prefs,
    permission,
    requestBrowserPermission,
    notifyPayoutTurn,
    notifyContributionDue,
    notifyCircleFull,
    toggleCircleNotifications,
    isCircleEnabled,
    savePrefs,
  }
}
