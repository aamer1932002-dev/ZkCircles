import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  Search, 
  Users, 
  Coins, 
  Clock,
  Filter,
  ArrowRight,
  Loader2,
  Globe,
  TrendingUp
} from 'lucide-react'
import { useCircles } from '../hooks/useCircles'
import { getTokenConfig } from '../config'
import PageTransition from '../components/PageTransition'
import AnimatedCounter from '../components/AnimatedCounter'

const statusFilters = [
  { value: 'all', label: 'All' },
  { value: 'forming', label: 'Forming' },
  { value: 'active', label: 'Active' },
  { value: 'completed', label: 'Completed' },
]

export default function Explorer() {
  const { circles, isLoading, stats, fetchCircles } = useCircles()
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')

  useEffect(() => {
    fetchCircles({ status: statusFilter === 'all' ? undefined : statusFilter })
  }, [statusFilter, fetchCircles])

  const filteredCircles = circles.filter(circle => {
    if (!searchQuery) return true
    return (
      circle.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      circle.name?.toLowerCase().includes(searchQuery.toLowerCase())
    )
  })

  return (
    <PageTransition>
    <div className="min-h-screen py-12 md:py-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ease: [0.25, 0.4, 0.25, 1] }}
          className="text-center mb-12"
        >
          <motion.div 
            className="inline-flex items-center gap-2 px-4 py-2 bg-amber-100/80 backdrop-blur-sm rounded-full mb-4 border border-amber-200/50"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1 }}
          >
            <Globe className="w-4 h-4 text-amber-600" />
            <span className="text-sm font-medium text-amber-800">
              Explore the ZkCircles Network
            </span>
          </motion.div>
          <h1 className="font-display text-3xl md:text-4xl font-bold text-midnight-900 mb-4">
            Circle Explorer
          </h1>
          <p className="text-midnight-600 max-w-2xl mx-auto">
            Discover active savings circles around the world. Find one that fits 
            your goals or get inspired to create your own.
          </p>
        </motion.div>

        {/* Stats */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, ease: [0.25, 0.4, 0.25, 1] }}
          className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8"
        >
          {[
            { icon: TrendingUp, color: 'text-amber-500', value: stats.totalCircles, label: 'Total Circles' },
            { icon: Users, color: 'text-forest-500', value: stats.activeMembers, label: 'Active Members' },
            { icon: Coins, color: 'text-terra-500', value: parseFloat(((stats.totalVolume || 0) / 1_000_000).toFixed(1)), label: 'Total Volume', decimals: 1 },
            { icon: Globe, color: 'text-midnight-500', value: stats.completedCircles, label: 'Completed' },
          ].map((stat, i) => (
            <motion.div 
              key={stat.label} 
              className="card text-center group hover:border-amber-200/80 hover:-translate-y-1 transition-all duration-300"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 + i * 0.05 }}
            >
              <stat.icon className={`w-6 h-6 ${stat.color} mx-auto mb-2 group-hover:scale-110 transition-transform`} />
              <div className="font-display text-2xl font-bold text-midnight-900">
                <AnimatedCounter value={stat.value} decimals={stat.decimals || 0} />
              </div>
              <div className="text-sm text-midnight-500">{stat.label}</div>
            </motion.div>
          ))}
        </motion.div>

        {/* Search & Filters */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, ease: [0.25, 0.4, 0.25, 1] }}
          className="flex flex-col md:flex-row gap-4 mb-8"
        >
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-midnight-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search circles by name or ID..."
              className="input pl-12"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="w-5 h-5 text-midnight-500" />
            <div className="flex bg-cream-100 rounded-xl p-1">
              {statusFilters.map(filter => (
                <button
                  key={filter.value}
                  onClick={() => setStatusFilter(filter.value)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    statusFilter === filter.value
                      ? 'bg-white text-midnight-900 shadow-sm'
                      : 'text-midnight-600 hover:text-midnight-900'
                  }`}
                >
                  {filter.label}
                </button>
              ))}
            </div>
          </div>
        </motion.div>

        {/* Results */}
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-10 h-10 text-amber-500 animate-spin" />
          </div>
        ) : filteredCircles.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="card text-center py-16"
          >
            <Globe className="w-16 h-16 text-midnight-300 mx-auto mb-4" />
            <h3 className="font-display text-lg font-semibold text-midnight-900 mb-2">
              No Circles Found
            </h3>
            <p className="text-midnight-600 mb-6">
              {searchQuery 
                ? 'No circles match your search criteria.' 
                : 'No circles available with the selected filter.'}
            </p>
            <Link to="/create" className="btn-primary inline-flex items-center gap-2">
              Create the First One
              <ArrowRight className="w-5 h-5" />
            </Link>
          </motion.div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredCircles.map((circle, index) => {
              const statusColors = {
                0: 'badge-amber',
                1: 'badge-forest',
                2: 'badge-midnight',
                3: 'badge-terra',
              }
              const statusLabels = {
                0: 'Forming',
                1: 'Active',
                2: 'Completed',
                3: 'Cancelled',
              }
              const progress = circle.status === 1 
                ? (circle.currentCycle / circle.totalCycles) * 100 
                : circle.status === 2 ? 100 : 0

              return (
                <motion.div
                  key={circle.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 + index * 0.03 }}
                >
                  <Link to={`/circle/${circle.id}`} className="card-interactive block h-full backdrop-blur-sm hover:-translate-y-1.5 transition-all duration-300">
                    <div className="flex items-center justify-between mb-4">
                      <div className="w-12 h-12 bg-gradient-to-br from-amber-400 to-amber-600 rounded-full flex items-center justify-center shadow-lg shadow-amber-200/40">
                        <Users className="w-6 h-6 text-white" />
                      </div>
                      <span className={statusColors[circle.status as keyof typeof statusColors]}>
                        {statusLabels[circle.status as keyof typeof statusLabels]}
                      </span>
                    </div>

                    <h3 className="font-display text-lg font-semibold text-midnight-900 mb-1">
                      {circle.name || `Circle ${circle.id.slice(0, 8)}...`}
                    </h3>
                    <p className="text-sm text-midnight-500 font-mono mb-4">
                      {circle.id.slice(0, 12)}...
                    </p>

                    <div className="space-y-3 mb-4">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-midnight-500 flex items-center gap-2">
                          <Users className="w-4 h-4" />
                          Members
                        </span>
                        <span className="font-medium text-midnight-900">
                          {circle.membersJoined}/{circle.maxMembers}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-midnight-500 flex items-center gap-2">
                          <Coins className="w-4 h-4" />
                          Per Cycle
                        </span>
                        <span className="font-medium text-midnight-900">
                          {(circle.contributionAmount / 1_000_000).toFixed(3)} {getTokenConfig(circle.tokenId).symbol}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-midnight-500 flex items-center gap-2">
                          <Clock className="w-4 h-4" />
                          Duration
                        </span>
                        <span className="font-medium text-midnight-900">
                          {Math.round(circle.cycleDurationBlocks / 24000)} days
                        </span>
                      </div>
                    </div>

                    {/* Progress bar */}
                    {circle.status !== 0 && (
                      <div>
                        <div className="flex justify-between text-xs text-midnight-500 mb-1">
                          <span>Progress</span>
                          <span>{Math.round(progress)}%</span>
                        </div>
                        <div className="h-2 bg-cream-200 rounded-full overflow-hidden">
                          <motion.div
                            className="h-full bg-gradient-to-r from-amber-400 to-forest-500 rounded-full"
                            initial={{ width: 0 }}
                            animate={{ width: `${progress}%` }}
                            transition={{ delay: 0.3 + index * 0.05, duration: 0.8, ease: [0.25, 0.4, 0.25, 1] }}
                          />
                        </div>
                      </div>
                    )}

                    {circle.status === 0 && (
                      <div className="pt-2 text-center">
                        <span className="text-sm font-medium text-amber-600">
                          {circle.maxMembers - circle.membersJoined} spots available
                        </span>
                      </div>
                    )}
                  </Link>
                </motion.div>
              )
            })}
          </div>
        )}
      </div>
    </div>
    </PageTransition>
  )
}
