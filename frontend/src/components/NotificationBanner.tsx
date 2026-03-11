import { Bell, BellOff, BellRing, X } from 'lucide-react'
import { useState } from 'react'
import { useNotifications } from '../hooks/useNotifications'

interface Props {
  circleId?: string
  circleName?: string
}

export default function NotificationBanner({ circleId, circleName: _circleName }: Props) {
  const [dismissed, setDismissed] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const {
    prefs,
    permission,
    requestBrowserPermission,
    toggleCircleNotifications,
    isCircleEnabled,
    savePrefs,
  } = useNotifications()

  // Don't show if already enabled or dismissed
  if (dismissed) return null
  if (permission === 'granted' && (!circleId || isCircleEnabled(circleId))) return null
  if (permission === 'denied') return null

  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50/80 p-4 flex flex-col sm:flex-row items-start sm:items-center gap-3">
      <div className="flex items-center gap-3 flex-1">
        <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
          <Bell className="w-5 h-5 text-amber-600" />
        </div>
        <div>
          <p className="text-sm font-medium text-midnight-800">
            {circleId
              ? `Get notified when it's your turn to contribute or receive payout`
              : 'Enable notifications to stay on top of your savings circles'}
          </p>
          <p className="text-xs text-midnight-500 mt-0.5">
            Browser push notifications — no account needed
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {!showSettings ? (
          <button
            onClick={async () => {
              if (permission !== 'granted') {
                const granted = await requestBrowserPermission()
                if (granted && circleId) toggleCircleNotifications(circleId, true)
              } else {
                setShowSettings(true)
              }
            }}
            className="btn-primary text-xs py-1.5 px-3 flex items-center gap-1.5"
          >
            <BellRing className="w-3.5 h-3.5" />
            Enable
          </button>
        ) : (
          <div className="flex items-center gap-2">
            <input
              type="email"
              placeholder="email@example.com (optional)"
              value={prefs.email}
              onChange={e => savePrefs({ email: e.target.value })}
              className="text-xs border border-cream-300 rounded-lg px-2 py-1.5 bg-white w-44 focus:outline-none focus:ring-2 focus:ring-amber-300"
            />
            <button
              onClick={() => {
                if (prefs.email) savePrefs({ emailEnabled: true })
                if (circleId) toggleCircleNotifications(circleId, true)
                setShowSettings(false)
                setDismissed(true)
              }}
              className="btn-primary text-xs py-1.5 px-3"
            >
              Save
            </button>
          </div>
        )}
        <button
          onClick={() => setDismissed(true)}
          className="p-1.5 rounded-lg hover:bg-amber-100 text-midnight-400 hover:text-midnight-600 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}

// Compact bell icon toggle for circle detail header
export function NotificationToggle({ circleId, circleName: _circleName }: { circleId: string; circleName: string }) {
  const { permission, requestBrowserPermission, toggleCircleNotifications, isCircleEnabled } = useNotifications()
  const enabled = isCircleEnabled(circleId)

  const handleToggle = async () => {
    if (permission !== 'granted') {
      const granted = await requestBrowserPermission()
      if (granted) toggleCircleNotifications(circleId, !enabled)
    } else {
      toggleCircleNotifications(circleId, !enabled)
    }
  }

  return (
    <button
      onClick={handleToggle}
      title={enabled ? 'Disable notifications for this circle' : 'Enable notifications for this circle'}
      className={`p-2 rounded-xl transition-all border ${
        enabled
          ? 'bg-amber-100 border-amber-300 text-amber-700'
          : 'bg-cream-100 border-cream-300 text-midnight-500 hover:bg-amber-50'
      }`}
    >
      {enabled ? <BellRing className="w-4 h-4" /> : <BellOff className="w-4 h-4" />}
    </button>
  )
}
