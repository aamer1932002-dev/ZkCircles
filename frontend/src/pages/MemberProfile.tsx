import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useWallet } from '@provablehq/aleo-wallet-adaptor-react'
import { motion } from 'framer-motion'
import {
  User,
  Shield,
  TrendingUp,
  Coins,
  CheckCircle2,
  AlertCircle,
  Copy,
  Award,
  Flame,
  BarChart2,
  Users,
  Loader2,
  ArrowRight,
} from 'lucide-react'
import { useCreditScore } from '../hooks/useCreditScore'
import { fetchMyCircles } from '../services/api'
import type { CircleData } from '../services/api'
import { getTokenConfig } from '../config'
import PageTransition from '../components/PageTransition'
import AnimatedCounter from '../components/AnimatedCounter'

const gradeTextColors: Record<string, string> = {
  'A+': 'text-forest-600',
  'A':  'text-forest-600',
  'B':  'text-amber-600',
  'C':  'text-amber-700',
  'D':  'text-terra-600',
  'F':  'text-terra-600',
  '—':  'text-midnight-500',
}

function ScoreRing({ score, grade }: { score: number; grade: string }) {
  const circumference = 2 * Math.PI * 54
  const offset = circumference - (score / 100) * circumference

  return (
    <div className="relative w-36 h-36 mx-auto">
      <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
        <circle cx="60" cy="60" r="54" fill="none" stroke="#F3E8D4" strokeWidth="8" />
        <motion.circle
          cx="60" cy="60" r="54" fill="none"
          strokeWidth="8" strokeLinecap="round"
          className={score >= 70 ? 'stroke-forest-500' : score >= 40 ? 'stroke-amber-500' : 'stroke-terra-500'}
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1.2, ease: [0.25, 0.4, 0.25, 1] }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-display text-3xl font-bold text-midnight-900">
          <AnimatedCounter value={score} />
        </span>
        <span className={`text-sm font-bold ${gradeTextColors[grade] || 'text-midnight-500'}`}>
          {grade}
        </span>
      </div>
    </div>
  )
}

export default function MemberProfile() {
  const { address: paramAddress } = useParams<{ address: string }>()
  const wallet = useWallet() as any
  const { address: walletAddress } = wallet
  const targetAddress = paramAddress || walletAddress
  const isOwnProfile = !paramAddress || paramAddress === walletAddress

  const { creditScore, isLoading: scoreLoading, fetchScore } = useCreditScore()
  const [circles, setCircles] = useState<CircleData[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!targetAddress) return
    setIsLoading(true)
    Promise.all([
      fetchScore(targetAddress),
      fetchMyCircles(targetAddress),
    ]).then(([, data]) => {
      setCircles(data)
      setIsLoading(false)
    }).catch(() => setIsLoading(false))
  }, [targetAddress, fetchScore])

  const copyAddress = async () => {
    if (!targetAddress) return
    await navigator.clipboard.writeText(targetAddress)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (!targetAddress) {
    return (
      <PageTransition>
        <div className="max-w-lg mx-auto text-center py-20">
          <User className="w-16 h-16 text-midnight-300 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-midnight-800 mb-2">Connect Wallet</h2>
          <p className="text-midnight-600">Connect your wallet to view your profile and credit score.</p>
        </div>
      </PageTransition>
    )
  }

  if (isLoading || scoreLoading) {
    return (
      <PageTransition>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-10 h-10 text-amber-500 animate-spin" />
        </div>
      </PageTransition>
    )
  }

  return (
    <PageTransition>
      <div className="min-h-screen py-12 md:py-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Profile Header */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="card text-center mb-8"
          >
            <div className="w-20 h-20 bg-gradient-to-br from-amber-400 to-amber-600 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg shadow-amber-200/40">
              <User className="w-10 h-10 text-white" />
            </div>
            <h1 className="font-display text-2xl font-bold text-midnight-900 mb-1">
              {isOwnProfile ? 'Your Profile' : 'Member Profile'}
            </h1>
            <button
              onClick={copyAddress}
              className="inline-flex items-center gap-2 text-sm text-midnight-500 hover:text-midnight-700 transition-colors font-mono"
            >
              {targetAddress.slice(0, 12)}...{targetAddress.slice(-6)}
              {copied ? <CheckCircle2 className="w-4 h-4 text-forest-500" /> : <Copy className="w-4 h-4" />}
            </button>
            {creditScore.memberSince && (
              <p className="text-xs text-midnight-400 mt-2">
                Member since {new Date(creditScore.memberSince).toLocaleDateString()}
              </p>
            )}
          </motion.div>

          {/* Credit Score */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="card mb-8"
          >
            <h2 className="font-display text-lg font-semibold text-midnight-900 mb-6 flex items-center gap-2">
              <Shield className="w-5 h-5 text-amber-500" />
              On-Chain Credit Score
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="flex flex-col items-center">
                <ScoreRing score={creditScore.score} grade={creditScore.grade} />
                <p className="text-xs text-midnight-500 mt-3 text-center">
                  Derived from your on-chain contribution history
                </p>
              </div>

              <div className="md:col-span-2 grid grid-cols-2 gap-4">
                <ScoreStat icon={CheckCircle2} color="text-forest-500" label="On-Time Rate" value={`${Math.round(creditScore.onTimeRate * 100)}%`} />
                <ScoreStat icon={Award} color="text-amber-500" label="Completed" value={`${creditScore.circlesCompleted}`} />
                <ScoreStat icon={Flame} color="text-terra-500" label="Best Streak" value={`${creditScore.longestStreak} circles`} />
                <ScoreStat icon={TrendingUp} color="text-forest-500" label="Active Now" value={`${creditScore.circlesActive}`} />
                <ScoreStat icon={Coins} color="text-amber-500" label="Total Contributed" value={`${(creditScore.totalContributed / 1_000_000).toFixed(2)}`} />
                <ScoreStat icon={AlertCircle} color="text-terra-500" label="Missed" value={`${creditScore.missedContributions}`} />
              </div>
            </div>

            {/* Score breakdown */}
            <div className="mt-6 pt-6 border-t border-cream-200">
              <h3 className="text-xs font-semibold text-midnight-600 mb-3 uppercase tracking-wider">Score Breakdown</h3>
              <div className="space-y-2">
                <BreakdownBar label="On-Time Contributions" pct={creditScore.onTimeRate * 100} weight={40} />
                <BreakdownBar label="Completion Rate" pct={creditScore.circlesCompleted / Math.max(circles.length, 1) * 100} weight={25} />
                <BreakdownBar label="Participation Volume" pct={Math.min(circles.length / 20, 1) * 100} weight={15} />
                <BreakdownBar label="Streak Bonus" pct={Math.min(creditScore.longestStreak / 10, 1) * 100} weight={10} />
                <BreakdownBar label="Active Circles" pct={creditScore.circlesActive > 0 ? 100 : 0} weight={10} />
              </div>
            </div>
          </motion.div>

          {/* Circle History */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="card"
          >
            <h2 className="font-display text-lg font-semibold text-midnight-900 mb-4 flex items-center gap-2">
              <BarChart2 className="w-5 h-5 text-amber-500" />
              Circle History
              <span className="text-sm font-normal text-midnight-500">({circles.length})</span>
            </h2>

            {circles.length === 0 ? (
              <div className="text-center py-10">
                <Users className="w-12 h-12 text-midnight-300 mx-auto mb-3" />
                <p className="text-midnight-500 mb-4">No circles yet</p>
                {isOwnProfile && (
                  <Link to="/create" className="btn-primary inline-flex items-center gap-2 text-sm">
                    Create Your First Circle <ArrowRight className="w-4 h-4" />
                  </Link>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                {circles.map((circle, i) => {
                  const statusLabels: Record<number, string> = { 0: 'Forming', 1: 'Active', 2: 'Completed', 3: 'Cancelled' }
                  const statusColors: Record<number, string> = { 0: 'badge-amber', 1: 'badge-forest', 2: 'badge-midnight', 3: 'badge-terra' }
                  const token = getTokenConfig(circle.tokenId)

                  return (
                    <motion.div
                      key={circle.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.05 * i }}
                    >
                      <Link
                        to={`/circle/${circle.id}`}
                        className="flex items-center justify-between p-4 rounded-xl bg-cream-50 hover:bg-cream-100 transition-colors group"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-10 h-10 bg-gradient-to-br from-amber-400 to-amber-600 rounded-full flex items-center justify-center flex-shrink-0">
                            <Users className="w-5 h-5 text-white" />
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium text-midnight-900 text-sm truncate">
                              {circle.name || `Circle ${circle.id.slice(0, 8)}…`}
                            </p>
                            <p className="text-xs text-midnight-500">
                              {(circle.contributionAmount / 1_000_000).toFixed(3)} {token.symbol} · {circle.membersJoined}/{circle.maxMembers} members
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 flex-shrink-0">
                          <span className={statusColors[circle.status]}>{statusLabels[circle.status]}</span>
                          <ArrowRight className="w-4 h-4 text-midnight-400 group-hover:text-midnight-600 transition-colors" />
                        </div>
                      </Link>
                    </motion.div>
                  )
                })}
              </div>
            )}
          </motion.div>
        </div>
      </div>
    </PageTransition>
  )
}

function ScoreStat({ icon: Icon, color, label, value }: { icon: any; color: string; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-xl bg-cream-50">
      <Icon className={`w-5 h-5 ${color} flex-shrink-0`} />
      <div>
        <p className="text-xs text-midnight-500">{label}</p>
        <p className="font-semibold text-midnight-900 text-sm">{value}</p>
      </div>
    </div>
  )
}

function BreakdownBar({ label, pct, weight }: { label: string; pct: number; weight: number }) {
  const points = Math.round((pct / 100) * weight)
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-midnight-600 w-40 shrink-0">{label}</span>
      <div className="flex-1 h-2 bg-cream-200 rounded-full overflow-hidden">
        <motion.div
          className="h-full bg-gradient-to-r from-amber-400 to-amber-500 rounded-full"
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.8, ease: [0.25, 0.4, 0.25, 1] }}
        />
      </div>
      <span className="text-xs font-medium text-midnight-700 w-12 text-right">{points}/{weight}</span>
    </div>
  )
}
