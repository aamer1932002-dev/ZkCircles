import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useWallet } from '@provablehq/aleo-wallet-adaptor-react'
import { motion } from 'framer-motion'
import { toast } from 'react-hot-toast'
import { 
  Users, 
  Search,
  ArrowRight,
  Loader2,
  Clock,
  Coins,
  CheckCircle2,
  AlertCircle
} from 'lucide-react'
import { useJoinCircle } from '../hooks/useJoinCircle'
import { useCircles } from '../hooks/useCircles'

export default function JoinCircle() {
  const { circleId: urlCircleId } = useParams()
  const navigate = useNavigate()
  const { connected } = useWallet()
  const { joinCircle, isJoining, transactionStatus } = useJoinCircle()
  const { circles, isLoading: isLoadingCircles, fetchCircles } = useCircles()

  const [searchQuery, setSearchQuery] = useState(urlCircleId || '')
  const [selectedCircle, setSelectedCircle] = useState<string | null>(urlCircleId || null)

  useEffect(() => {
    fetchCircles({ status: 'forming' })
  }, [])

  // Filter circles that are still forming (accepting members)
  const availableCircles = circles.filter(c => c.status === 0)

  const handleJoin = async (circleId: string) => {
    if (!connected) {
      toast.error('Please connect your wallet first')
      return
    }

    try {
      const result = await joinCircle(circleId)
      if (result.success) {
        toast.success('Successfully joined the circle!')
        navigate(`/circle/${circleId}`)
      }
    } catch (error) {
      console.error('Failed to join circle:', error)
      toast.error('Failed to join circle. Please try again.')
    }
  }

  if (!connected) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center"
        >
          <div className="w-20 h-20 bg-forest-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <Users className="w-10 h-10 text-forest-600" />
          </div>
          <h2 className="font-display text-2xl font-semibold text-midnight-900 mb-3">
            Connect Your Wallet
          </h2>
          <p className="text-midnight-600 mb-6 max-w-md">
            To join a savings circle, please connect your Aleo wallet first.
          </p>
        </motion.div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-cream-50 py-12 md:py-20">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="font-display text-3xl md:text-4xl font-bold text-midnight-900 mb-2">
            Join a Savings Circle
          </h1>
          <p className="text-midnight-600">
            Find and join an existing circle to start saving with your community.
          </p>
        </motion.div>

        {/* Search */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mb-8"
        >
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-midnight-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by circle ID or name..."
              className="input pl-12"
            />
          </div>
        </motion.div>

        {/* Available Circles */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <h2 className="font-display text-xl font-semibold text-midnight-900 mb-4">
            Available Circles
          </h2>

          {isLoadingCircles ? (
            <div className="card flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 text-amber-500 animate-spin" />
            </div>
          ) : availableCircles.length === 0 ? (
            <div className="card text-center py-12">
              <AlertCircle className="w-12 h-12 text-midnight-400 mx-auto mb-4" />
              <h3 className="font-display text-lg font-semibold text-midnight-900 mb-2">
                No Circles Available
              </h3>
              <p className="text-midnight-600 mb-6">
                There are no circles accepting new members right now.
              </p>
              <button
                onClick={() => navigate('/create')}
                className="btn-primary inline-flex items-center gap-2"
              >
                Create Your Own Circle
                <ArrowRight className="w-5 h-5" />
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {availableCircles
                .filter(circle => 
                  !searchQuery || 
                  circle.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
                  circle.name?.toLowerCase().includes(searchQuery.toLowerCase())
                )
                .map((circle) => (
                  <motion.div
                    key={circle.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`card-hover cursor-pointer ${
                      selectedCircle === circle.id ? 'ring-2 ring-amber-400' : ''
                    }`}
                    onClick={() => setSelectedCircle(circle.id)}
                  >
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <div className="w-10 h-10 bg-gradient-to-br from-amber-400 to-amber-600 rounded-full flex items-center justify-center">
                            <Users className="w-5 h-5 text-white" />
                          </div>
                          <div>
                            <h3 className="font-display font-semibold text-midnight-900">
                              {circle.name || `Circle ${circle.id.slice(0, 8)}...`}
                            </h3>
                            <p className="text-sm text-midnight-500 font-mono">
                              {circle.id.slice(0, 12)}...{circle.id.slice(-6)}
                            </p>
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-4 mt-4">
                          <div className="flex items-center gap-2 text-sm text-midnight-600">
                            <Users className="w-4 h-4" />
                            <span>
                              {circle.membersJoined}/{circle.maxMembers} members
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-sm text-midnight-600">
                            <Coins className="w-4 h-4" />
                            <span>
                              {(circle.contributionAmount / 1_000_000).toFixed(3)} ALEO/cycle
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-sm text-midnight-600">
                            <Clock className="w-4 h-4" />
                            <span>
                              {Math.round(circle.cycleDurationBlocks / 24000)} day cycles
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-col items-end gap-2">
                        <span className="badge-amber">
                          {circle.maxMembers - circle.membersJoined} spots left
                        </span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            handleJoin(circle.id)
                          }}
                          disabled={isJoining}
                          className="btn-forest text-sm py-2"
                        >
                          {isJoining && selectedCircle === circle.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            'Join Circle'
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Transaction Status */}
                    {isJoining && selectedCircle === circle.id && transactionStatus && (
                      <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-xl">
                        <div className="flex items-center gap-2">
                          {transactionStatus === 'Completed' ? (
                            <CheckCircle2 className="w-4 h-4 text-forest-600" />
                          ) : (
                            <Loader2 className="w-4 h-4 text-amber-600 animate-spin" />
                          )}
                          <span className="text-sm text-amber-800">
                            {transactionStatus}
                          </span>
                        </div>
                      </div>
                    )}
                  </motion.div>
                ))}
            </div>
          )}
        </motion.div>

        {/* Direct Join by ID */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="mt-8"
        >
          <div className="card">
            <h3 className="font-display text-lg font-semibold text-midnight-900 mb-4">
              Have an Invite Link?
            </h3>
            <p className="text-midnight-600 mb-4">
              If someone shared a circle ID with you, paste it below to join directly.
            </p>
            <div className="flex gap-3">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Enter circle ID..."
                className="input flex-1 font-mono"
              />
              <button
                onClick={() => searchQuery && handleJoin(searchQuery)}
                disabled={!searchQuery || isJoining}
                className="btn-primary"
              >
                {isJoining ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <ArrowRight className="w-5 h-5" />
                )}
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  )
}
