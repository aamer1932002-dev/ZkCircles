import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useWallet } from '@provablehq/aleo-wallet-adaptor-react'
import { motion } from 'framer-motion'
import { 
  Users, 
  Plus, 
  Clock, 
  Coins,
  ArrowRight,
  Loader2,
  Circle,
  CheckCircle2,
  AlertCircle
} from 'lucide-react'
import { useMyCircles } from '../hooks/useMyCircles'

const statusLabels = {
  0: { label: 'Forming', color: 'badge-amber' },
  1: { label: 'Active', color: 'badge-forest' },
  2: { label: 'Completed', color: 'badge-midnight' },
  3: { label: 'Cancelled', color: 'badge-terra' },
}

export default function MyCircles() {
  const { connected, address } = useWallet()
  const { circles, isLoading, fetchMyCircles } = useMyCircles()

  useEffect(() => {
    if (connected && address) {
      fetchMyCircles()
    }
  }, [connected, address, fetchMyCircles])

  if (!connected) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center"
        >
          <div className="w-20 h-20 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <Circle className="w-10 h-10 text-amber-600" />
          </div>
          <h2 className="font-display text-2xl font-semibold text-midnight-900 mb-3">
            Connect Your Wallet
          </h2>
          <p className="text-midnight-600 mb-6 max-w-md">
            Connect your Aleo wallet to view your savings circles.
          </p>
        </motion.div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-cream-50 py-12 md:py-20">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8"
        >
          <div>
            <h1 className="font-display text-3xl md:text-4xl font-bold text-midnight-900 mb-2">
              My Circles
            </h1>
            <p className="text-midnight-600">
              Manage and track your savings circles.
            </p>
          </div>
          <Link to="/create" className="btn-primary inline-flex items-center gap-2">
            <Plus className="w-5 h-5" />
            Create Circle
          </Link>
        </motion.div>

        {/* Stats Overview */}
        {circles.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8"
          >
            <div className="card text-center">
              <div className="font-display text-2xl font-bold text-amber-600">
                {circles.length}
              </div>
              <div className="text-sm text-midnight-600">Total Circles</div>
            </div>
            <div className="card text-center">
              <div className="font-display text-2xl font-bold text-forest-600">
                {circles.filter(c => c.status === 1).length}
              </div>
              <div className="text-sm text-midnight-600">Active</div>
            </div>
            <div className="card text-center">
              <div className="font-display text-2xl font-bold text-midnight-600">
                {circles.filter(c => c.status === 2).length}
              </div>
              <div className="text-sm text-midnight-600">Completed</div>
            </div>
            <div className="card text-center">
              <div className="font-display text-2xl font-bold text-terra-600">
                {circles.reduce((acc, c) => acc + (c.totalContributed ?? 0), 0) / 1_000_000}
              </div>
              <div className="text-sm text-midnight-600">Total Saved (ALEO)</div>
            </div>
          </motion.div>
        )}

        {/* Circles List */}
        {isLoading ? (
          <div className="card flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 text-amber-500 animate-spin" />
          </div>
        ) : circles.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="card text-center py-16"
          >
            <AlertCircle className="w-16 h-16 text-midnight-300 mx-auto mb-6" />
            <h3 className="font-display text-xl font-semibold text-midnight-900 mb-3">
              No Circles Yet
            </h3>
            <p className="text-midnight-600 mb-8 max-w-md mx-auto">
              You haven't joined or created any savings circles yet. 
              Start your financial journey today!
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link to="/create" className="btn-primary inline-flex items-center justify-center gap-2">
                <Plus className="w-5 h-5" />
                Create a Circle
              </Link>
              <Link to="/join" className="btn-secondary inline-flex items-center justify-center gap-2">
                <Users className="w-5 h-5" />
                Join a Circle
              </Link>
            </div>
          </motion.div>
        ) : (
          <div className="space-y-4">
            {circles.map((circle, index) => {
              const status = statusLabels[circle.status as keyof typeof statusLabels]
              const progress = circle.currentCycle / circle.totalCycles * 100

              return (
                <motion.div
                  key={circle.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 + index * 0.05 }}
                >
                  <Link
                    to={`/circle/${circle.id}`}
                    className="card-interactive block"
                  >
                    <div className="flex flex-col lg:flex-row lg:items-center gap-6">
                      {/* Circle Info */}
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-3">
                          <div className="w-12 h-12 bg-gradient-to-br from-amber-400 to-amber-600 rounded-full flex items-center justify-center">
                            <Users className="w-6 h-6 text-white" />
                          </div>
                          <div>
                            <h3 className="font-display text-lg font-semibold text-midnight-900">
                              {circle.name || `Circle ${circle.id.slice(0, 8)}...`}
                            </h3>
                            <span className={status.color}>{status.label}</span>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-4 text-sm text-midnight-600">
                          <div className="flex items-center gap-2">
                            <Users className="w-4 h-4" />
                            <span>{circle.membersJoined}/{circle.maxMembers} members</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Coins className="w-4 h-4" />
                            <span>{(circle.contributionAmount / 1_000_000).toFixed(3)} ALEO/cycle</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Clock className="w-4 h-4" />
                            <span>Cycle {circle.currentCycle}/{circle.totalCycles}</span>
                          </div>
                        </div>
                      </div>

                      {/* Progress & Actions */}
                      <div className="flex flex-col sm:flex-row lg:flex-col items-start sm:items-center lg:items-end gap-4">
                        {/* Progress bar */}
                        <div className="w-full sm:w-48 lg:w-32">
                          <div className="flex justify-between text-xs text-midnight-500 mb-1">
                            <span>Progress</span>
                            <span>{Math.round(progress)}%</span>
                          </div>
                          <div className="h-2 bg-cream-200 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-amber-400 to-forest-500 rounded-full transition-all"
                              style={{ width: `${progress}%` }}
                            />
                          </div>
                        </div>

                        {/* Quick actions based on status */}
                        {circle.status === 1 && circle.isYourTurn && (
                          <span className="badge-forest flex items-center gap-1">
                            <CheckCircle2 className="w-4 h-4" />
                            Your turn!
                          </span>
                        )}
                        
                        {circle.status === 1 && circle.needsContribution && (
                          <span className="badge-terra flex items-center gap-1">
                            <AlertCircle className="w-4 h-4" />
                            Contribute now
                          </span>
                        )}

                        <ArrowRight className="w-5 h-5 text-midnight-400" />
                      </div>
                    </div>
                  </Link>
                </motion.div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
