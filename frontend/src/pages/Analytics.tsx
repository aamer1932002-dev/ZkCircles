import { useEffect } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, PieChart, Pie, Cell
} from 'recharts'
import {
  ArrowLeft, TrendingUp, Users, Coins, Calendar,
  CheckCircle2, Clock, Loader2, AlertCircle, BarChart2,
  Trophy, Zap, Target
} from 'lucide-react'
import { useAnalytics } from '../hooks/useAnalytics'

const COLORS = ['#D97706', '#16A34A', '#2563EB', '#DC2626', '#7C3AED', '#0891B2']

function HealthBadge({ score }: { score: number }) {
  const color =
    score >= 80 ? 'text-green-700 bg-green-100' :
    score >= 50 ? 'text-amber-700 bg-amber-100' :
    'text-red-700 bg-red-100'
  const label = score >= 80 ? 'Healthy' : score >= 50 ? 'At Risk' : 'Critical'
  return (
    <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-semibold ${color}`}>
      <Zap className="w-3.5 h-3.5" />
      {label} · {score}%
    </span>
  )
}

function StatCard({ icon: Icon, label, value, sub, color }: {
  icon: any; label: string; value: string; sub?: string; color: string
}) {
  return (
    <div className="bg-white rounded-2xl border border-cream-200 p-5">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${color}`}>
        <Icon className="w-5 h-5" />
      </div>
      <p className="text-xs text-midnight-500 font-medium uppercase tracking-wide">{label}</p>
      <p className="text-2xl font-bold text-midnight-900 mt-1">{value}</p>
      {sub && <p className="text-xs text-midnight-500 mt-1">{sub}</p>}
    </div>
  )
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-cream-200 rounded-xl shadow-lg p-3 text-sm">
      <p className="font-semibold text-midnight-800 mb-1">{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} style={{ color: p.color }} className="text-xs">
          {p.name}: <span className="font-medium">{typeof p.value === 'number' && p.name.toLowerCase().includes('aleo')
            ? `${(p.value / 1_000_000).toFixed(2)} ALEO`
            : p.name.includes('%') || p.name.toLowerCase().includes('rate')
            ? `${p.value}%`
            : p.value}</span>
        </p>
      ))}
    </div>
  )
}

export default function Analytics() {
  const { circleId } = useParams<{ circleId: string }>()
  const navigate = useNavigate()
  const { analytics, isLoading, error, fetchAnalytics } = useAnalytics()

  useEffect(() => {
    if (circleId) fetchAnalytics(circleId)
  }, [circleId])

  if (!circleId) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center">
          <BarChart2 className="w-12 h-12 text-midnight-400 mx-auto mb-3" />
          <p className="text-midnight-600">No circle selected.</p>
          <Link to="/my-circles" className="btn-primary mt-4 inline-block">View My Circles</Link>
        </div>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-10 h-10 text-amber-500 animate-spin mx-auto mb-3" />
          <p className="text-midnight-600">Loading analytics…</p>
        </div>
      </div>
    )
  }

  if (error || !analytics) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center px-4">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-terra-500 mx-auto mb-3" />
          <p className="text-midnight-700 font-medium mb-2">Failed to load analytics</p>
          <p className="text-midnight-500 text-sm mb-4">{error}</p>
          <button onClick={() => fetchAnalytics(circleId)} className="btn-primary">Retry</button>
        </div>
      </div>
    )
  }

  const memberPieData = analytics.memberContributions.map((m, i) => ({
    name: m.shortAddress,
    value: m.totalContributed,
    color: COLORS[i % COLORS.length],
  }))

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">

      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col sm:flex-row sm:items-center gap-4">
        <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-midnight-500 hover:text-midnight-800 transition-colors text-sm">
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-display text-2xl font-bold text-midnight-900">
              {analytics.circleName}
            </h1>
            <HealthBadge score={analytics.healthScore} />
          </div>
          <p className="text-sm text-midnight-500 mt-1">
            Cycle {analytics.completedCycles}/{analytics.totalCycles} · {analytics.totalMembers} members
          </p>
        </div>
        <Link to={`/circle/${circleId}`} className="btn-secondary text-sm self-start sm:self-auto">
          View Circle
        </Link>
      </motion.div>

      {/* KPI Cards */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="grid grid-cols-2 lg:grid-cols-4 gap-4"
      >
        <StatCard
          icon={TrendingUp}
          label="Total Contributed"
          value={`${(analytics.totalVolumeContributed / 1_000_000).toFixed(2)}`}
          sub="ALEO across all members"
          color="bg-amber-100 text-amber-700"
        />
        <StatCard
          icon={Trophy}
          label="Total Paid Out"
          value={`${(analytics.totalVolumePaid / 1_000_000).toFixed(2)}`}
          sub="ALEO distributed"
          color="bg-green-100 text-green-700"
        />
        <StatCard
          icon={Users}
          label="Active Members"
          value={`${analytics.totalMembers}`}
          sub={`of ${analytics.totalCycles} slots filled`}
          color="bg-blue-100 text-blue-700"
        />
        <StatCard
          icon={Target}
          label="Completion"
          value={`${analytics.totalCycles > 0 ? Math.round((analytics.completedCycles / analytics.totalCycles) * 100) : 0}%`}
          sub={`${analytics.completedCycles} of ${analytics.totalCycles} cycles done`}
          color="bg-purple-100 text-purple-700"
        />
      </motion.div>

      {/* Contribution History Chart */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="bg-white rounded-2xl border border-cream-200 p-6"
      >
        <div className="flex items-center gap-3 mb-6">
          <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center">
            <TrendingUp className="w-4.5 h-4.5 text-amber-700" />
          </div>
          <div>
            <h2 className="font-semibold text-midnight-900">Contribution History</h2>
            <p className="text-xs text-midnight-500">Funds collected vs expected per cycle</p>
          </div>
        </div>
        {analytics.cycleData.length > 0 ? (
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={analytics.cycleData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="gradContributed" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#D97706" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#D97706" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gradExpected" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6B7280" stopOpacity={0.1} />
                  <stop offset="95%" stopColor="#6B7280" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#F3E8D4" />
              <XAxis dataKey="label" tick={{ fontSize: 12, fill: '#6B7280' }} />
              <YAxis tickFormatter={v => `${(v / 1_000_000).toFixed(1)}`} tick={{ fontSize: 11, fill: '#6B7280' }} />
              <Tooltip content={<CustomTooltip />} />
              <Legend />
              <Area type="monotone" dataKey="expectedAmount" name="Expected (ALEO)" stroke="#9CA3AF" strokeWidth={1.5} fill="url(#gradExpected)" strokeDasharray="4 4" />
              <Area type="monotone" dataKey="totalContributed" name="Contributed (ALEO)" stroke="#D97706" strokeWidth={2.5} fill="url(#gradContributed)" />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-48 flex items-center justify-center text-midnight-400 text-sm">
            No cycle data yet. Circle is still forming.
          </div>
        )}
      </motion.div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Member Contribution Bar Chart */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="bg-white rounded-2xl border border-cream-200 p-6"
        >
          <div className="flex items-center gap-3 mb-5">
            <div className="w-9 h-9 rounded-xl bg-blue-100 flex items-center justify-center">
              <BarChart2 className="w-4.5 h-4.5 text-blue-700" />
            </div>
            <div>
              <h2 className="font-semibold text-midnight-900">Member Contributions</h2>
              <p className="text-xs text-midnight-500">Total contributed per member</p>
            </div>
          </div>
          {analytics.memberContributions.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={analytics.memberContributions} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F3E8D4" />
                <XAxis dataKey="shortAddress" tick={{ fontSize: 10, fill: '#6B7280' }} />
                <YAxis tickFormatter={v => `${(v / 1_000_000).toFixed(1)}`} tick={{ fontSize: 10, fill: '#6B7280' }} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="totalContributed" name="Contributed (ALEO)" fill="#D97706" radius={[6, 6, 0, 0]}>
                  {analytics.memberContributions.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-40 flex items-center justify-center text-midnight-400 text-sm">
              No contributions yet.
            </div>
          )}
        </motion.div>

        {/* Contribution Share Pie Chart */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white rounded-2xl border border-cream-200 p-6"
        >
          <div className="flex items-center gap-3 mb-5">
            <div className="w-9 h-9 rounded-xl bg-purple-100 flex items-center justify-center">
              <Coins className="w-4.5 h-4.5 text-purple-700" />
            </div>
            <div>
              <h2 className="font-semibold text-midnight-900">Contribution Share</h2>
              <p className="text-xs text-midnight-500">Proportional contribution by member</p>
            </div>
          </div>
          {memberPieData.some(d => d.value > 0) ? (
            <div className="flex items-center gap-4">
              <ResponsiveContainer width="55%" height={200}>
                <PieChart>
                  <Pie data={memberPieData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3} dataKey="value">
                    {memberPieData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(val: any) => [`${(val / 1_000_000).toFixed(2)} ALEO`]} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex-1 space-y-2">
                {memberPieData.map((m, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs">
                    <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: m.color }} />
                    <span className="text-midnight-600 truncate">{m.name}</span>
                    <span className="ml-auto font-medium text-midnight-800 shrink-0">
                      {(m.value / 1_000_000).toFixed(1)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="h-40 flex items-center justify-center text-midnight-400 text-sm">
              No contributions yet.
            </div>
          )}
        </motion.div>
      </div>

      {/* Payout Schedule */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25 }}
        className="bg-white rounded-2xl border border-cream-200 p-6"
      >
        <div className="flex items-center gap-3 mb-6">
          <div className="w-9 h-9 rounded-xl bg-green-100 flex items-center justify-center">
            <Calendar className="w-4.5 h-4.5 text-green-700" />
          </div>
          <div>
            <h2 className="font-semibold text-midnight-900">Payout Schedule</h2>
            <p className="text-xs text-midnight-500">Expected distribution timeline</p>
          </div>
        </div>
        <div className="relative">
          {/* Timeline line */}
          <div className="absolute left-[22px] top-3 bottom-3 w-0.5 bg-cream-200" />
          <div className="space-y-4">
            {analytics.payoutSchedule.map((item) => (
              <div key={item.cycle} className="flex items-start gap-4 pl-1">
                {/* Status dot */}
                <div className={`relative z-10 w-11 h-11 rounded-full flex items-center justify-center shrink-0 border-2 ${
                  item.status === 'completed'
                    ? 'bg-green-100 border-green-400 text-green-700'
                    : item.status === 'current'
                    ? 'bg-amber-100 border-amber-400 text-amber-700 ring-4 ring-amber-200'
                    : 'bg-white border-cream-300 text-midnight-400'
                }`}>
                  {item.status === 'completed'
                    ? <CheckCircle2 className="w-5 h-5" />
                    : item.status === 'current'
                    ? <Clock className="w-5 h-5" />
                    : <span className="text-xs font-bold">{item.cycle}</span>
                  }
                </div>
                {/* Content */}
                <div className={`flex-1 rounded-xl p-3 border ${
                  item.status === 'current'
                    ? 'bg-amber-50 border-amber-200'
                    : item.status === 'completed'
                    ? 'bg-green-50/50 border-green-100'
                    : 'bg-cream-50 border-cream-200'
                }`}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="font-medium text-sm text-midnight-800">
                        Cycle {item.cycle} Payout
                        {item.status === 'current' && (
                          <span className="ml-2 text-xs bg-amber-200 text-amber-800 px-2 py-0.5 rounded-full">Active</span>
                        )}
                        {item.status === 'completed' && (
                          <span className="ml-2 text-xs bg-green-200 text-green-800 px-2 py-0.5 rounded-full">Done</span>
                        )}
                      </p>
                      <p className="text-xs text-midnight-500 mt-0.5">
                        {item.estimatedDate !== 'TBD'
                          ? `Est. ${item.estimatedDate} · Block ${item.expectedBlock.toLocaleString()}`
                          : 'Date TBD — circle not yet started'}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-midnight-900 text-sm">
                        {(item.amount / 1_000_000).toFixed(2)} ALEO
                      </p>
                      <p className="text-xs text-midnight-500">pot amount</p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </motion.div>

      {/* Cycle Completion Rate Chart */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="bg-white rounded-2xl border border-cream-200 p-6"
      >
        <div className="flex items-center gap-3 mb-6">
          <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center">
            <Target className="w-4.5 h-4.5 text-amber-700" />
          </div>
          <div>
            <h2 className="font-semibold text-midnight-900">Cycle Completion Rate</h2>
            <p className="text-xs text-midnight-500">% of members contributed per cycle</p>
          </div>
        </div>
        {analytics.cycleData.length > 0 ? (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={analytics.cycleData} margin={{ top: 0, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F3E8D4" />
              <XAxis dataKey="label" tick={{ fontSize: 12, fill: '#6B7280' }} />
              <YAxis domain={[0, 100]} tickFormatter={v => `${v}%`} tick={{ fontSize: 11, fill: '#6B7280' }} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="completionRate" name="Completion Rate %" fill="#16A34A" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-40 flex items-center justify-center text-midnight-400 text-sm">
            No cycle data yet.
          </div>
        )}
      </motion.div>

    </div>
  )
}
