import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  ArrowLeft,
  CheckCircle2,
  XCircle,
  Clock,
  Users,
  TrendingUp,
  Award,
  Loader2,
  AlertTriangle,
} from 'lucide-react'
import { BACKEND_URL, getTokenConfig } from '../config'
import { shortenAddress, formatAleo } from '../utils/aleo-utils'

interface CycleHistory {
  cycle: number
  expected: number
  actual: number
  completionRate: number
}

interface MemberContribution {
  address: string
  shortAddress: string
  contributed: number
  expected: number
  missedCycles: number
  cycles: boolean[]
}

interface PayoutEntry {
  cycle: number
  recipient: string
  amount: number
  status: 'completed' | 'current' | 'upcoming'
}

interface DashboardData {
  circleId: string
  circleName: string
  totalCycles: number
  completedCycles: number
  currentCycle: number
  totalContributed: number
  totalPaidOut: number
  activeMembers: number
  completionPercentage: number
  healthScore: number
  cycleHistory: CycleHistory[]
  memberContributions: MemberContribution[]
  payoutSchedule: PayoutEntry[]
  tokenId?: string
}

export default function CycleDashboard() {
  const { circleId } = useParams()
  const [data, setData] = useState<DashboardData | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!circleId) return
    setIsLoading(true)
    fetch(`${BACKEND_URL}/api/circles/${circleId}/analytics`)
      .then(r => r.json())
      .then(d => { setData(d); setIsLoading(false) })
      .catch(() => setIsLoading(false))
  }, [circleId])

  if (isLoading) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-amber-500 animate-spin" />
      </div>
    )
  }

  if (!data) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center">
        <div className="text-center">
          <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
          <p className="text-midnight-600">Dashboard data not available.</p>
          <Link to={`/circle/${circleId}`} className="text-amber-600 hover:underline mt-2 inline-block">
            Back to circle
          </Link>
        </div>
      </div>
    )
  }

  const tokenConfig = getTokenConfig(data.tokenId)
  const symbol = tokenConfig.symbol

  return (
    <div className="min-h-screen bg-cream-50 py-12 md:py-20">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <Link
            to={`/circle/${circleId}`}
            className="inline-flex items-center gap-2 text-amber-600 hover:text-amber-700 mb-4"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Circle
          </Link>
          <h1 className="font-display text-3xl md:text-4xl font-bold text-midnight-900 mb-2">
            Cycle Dashboard
          </h1>
          <p className="text-midnight-600">
            {data.circleName || `Circle ${circleId?.slice(0, 12)}...`}
          </p>
        </motion.div>

        {/* Stats Grid */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8"
        >
          {[
            { label: 'Health Score', value: `${data.healthScore}%`, icon: TrendingUp, color: data.healthScore >= 80 ? 'text-green-600' : data.healthScore >= 50 ? 'text-amber-600' : 'text-red-500' },
            { label: 'Completion', value: `${data.completionPercentage}%`, icon: CheckCircle2, color: 'text-forest-600' },
            { label: 'Total Contributed', value: `${formatAleo(data.totalContributed)} ${symbol}`, icon: Award, color: 'text-amber-600' },
            { label: 'Active Members', value: data.activeMembers, icon: Users, color: 'text-blue-600' },
          ].map((stat, i) => (
            <div key={i} className="card p-4">
              <div className="flex items-center gap-2 mb-1">
                <stat.icon className={`w-4 h-4 ${stat.color}`} />
                <span className="text-xs text-midnight-500">{stat.label}</span>
              </div>
              <p className={`font-display text-xl font-bold ${stat.color}`}>{stat.value}</p>
            </div>
          ))}
        </motion.div>

        {/* Cycle Timeline */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="card mb-8"
        >
          <h2 className="font-display text-xl font-semibold text-midnight-900 mb-6">
            Cycle Timeline
          </h2>
          <div className="space-y-3">
            {data.cycleHistory.map((c) => {
              const isCurrent = c.cycle === data.currentCycle
              const isCompleted = c.cycle < data.currentCycle
              const isFuture = c.cycle > data.currentCycle

              return (
                <div key={c.cycle} className={`flex items-center gap-4 p-3 rounded-xl transition-all ${
                  isCurrent ? 'bg-amber-50 ring-2 ring-amber-300' :
                  isCompleted ? 'bg-green-50/50' : 'bg-cream-100/50'
                }`}>
                  {/* Cycle number indicator */}
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                    isCompleted ? 'bg-green-100 text-green-700' :
                    isCurrent ? 'bg-amber-100 text-amber-700' :
                    'bg-cream-200 text-midnight-400'
                  }`}>
                    {isCompleted ? (
                      <CheckCircle2 className="w-5 h-5" />
                    ) : isCurrent ? (
                      <Clock className="w-5 h-5" />
                    ) : (
                      <span className="text-sm font-semibold">{c.cycle}</span>
                    )}
                  </div>

                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium text-midnight-900">
                        Cycle {c.cycle}
                        {isCurrent && <span className="ml-2 text-xs bg-amber-200 text-amber-800 px-2 py-0.5 rounded-full">Current</span>}
                      </span>
                      <span className="text-sm text-midnight-600">
                        {isFuture ? 'Upcoming' : `${c.completionRate}% complete`}
                      </span>
                    </div>
                    {!isFuture && (
                      <div className="w-full h-2 bg-cream-200 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            c.completionRate === 100 ? 'bg-green-500' :
                            c.completionRate > 0 ? 'bg-amber-400' : 'bg-cream-300'
                          }`}
                          style={{ width: `${c.completionRate}%` }}
                        />
                      </div>
                    )}
                  </div>

                  <div className="text-right text-sm flex-shrink-0">
                    <span className={isFuture ? 'text-midnight-400' : 'text-midnight-700'}>
                      {formatAleo(c.actual)} / {formatAleo(c.expected)} {symbol}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </motion.div>

        {/* Contribution Heatmap */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="card mb-8"
        >
          <h2 className="font-display text-xl font-semibold text-midnight-900 mb-6">
            Member Contribution Map
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  <th className="text-left text-sm text-midnight-500 pb-3 pr-4">Member</th>
                  {Array.from({ length: data.totalCycles }, (_, i) => (
                    <th key={i} className="text-center text-xs text-midnight-500 pb-3 px-1 min-w-[36px]">
                      C{i + 1}
                    </th>
                  ))}
                  <th className="text-right text-sm text-midnight-500 pb-3 pl-4">Missed</th>
                </tr>
              </thead>
              <tbody>
                {data.memberContributions.map((m, idx) => (
                  <tr key={idx} className="border-t border-cream-200">
                    <td className="py-2 pr-4">
                      <span className="text-sm font-mono text-midnight-700">
                        {m.shortAddress || shortenAddress(m.address)}
                      </span>
                    </td>
                    {m.cycles.map((contributed, cycleIdx) => {
                      const isFuture = cycleIdx + 1 > data.currentCycle
                      return (
                        <td key={cycleIdx} className="py-2 px-1 text-center">
                          {isFuture ? (
                            <div className="w-6 h-6 mx-auto rounded bg-cream-100" />
                          ) : contributed ? (
                            <div className="w-6 h-6 mx-auto rounded bg-green-400 flex items-center justify-center">
                              <CheckCircle2 className="w-3.5 h-3.5 text-white" />
                            </div>
                          ) : (
                            <div className="w-6 h-6 mx-auto rounded bg-red-400 flex items-center justify-center">
                              <XCircle className="w-3.5 h-3.5 text-white" />
                            </div>
                          )}
                        </td>
                      )
                    })}
                    <td className="py-2 pl-4 text-right">
                      <span className={`text-sm font-medium ${m.missedCycles > 0 ? 'text-red-600' : 'text-green-600'}`}>
                        {m.missedCycles}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>

        {/* Payout Schedule */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="card"
        >
          <h2 className="font-display text-xl font-semibold text-midnight-900 mb-6">
            Payout Schedule
          </h2>
          <div className="space-y-3">
            {data.payoutSchedule.map((p, i) => (
              <div
                key={i}
                className={`flex items-center justify-between p-3 rounded-xl ${
                  p.status === 'completed' ? 'bg-green-50' :
                  p.status === 'current' ? 'bg-amber-50 ring-1 ring-amber-200' :
                  'bg-cream-50'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                    p.status === 'completed' ? 'bg-green-200 text-green-800' :
                    p.status === 'current' ? 'bg-amber-200 text-amber-800' :
                    'bg-cream-200 text-midnight-500'
                  }`}>
                    {p.cycle}
                  </div>
                  <div>
                    <span className="text-sm font-mono text-midnight-700">
                      {shortenAddress(p.recipient)}
                    </span>
                    {p.status === 'current' && (
                      <span className="ml-2 text-xs bg-amber-200 text-amber-800 px-2 py-0.5 rounded-full">
                        Current Winner
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-midnight-900">
                    {formatAleo(p.amount)} {symbol}
                  </span>
                  {p.status === 'completed' && <CheckCircle2 className="w-4 h-4 text-green-600" />}
                  {p.status === 'current' && <Clock className="w-4 h-4 text-amber-600" />}
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  )
}
