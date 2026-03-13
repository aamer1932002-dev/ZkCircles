import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useWallet } from '@provablehq/aleo-wallet-adaptor-react'
import { motion } from 'framer-motion'
import { toast } from 'react-hot-toast'
import {
  ArrowLeft,
  AlertTriangle,
  ThumbsUp,
  ThumbsDown,
  Gavel,
  Loader2,
  Plus,
  Shield,
  Users,
  CheckCircle2,
  XCircle,
} from 'lucide-react'
import { useOnChainDispute } from '../hooks/useOnChainDispute'
import { fetchDisputes, DisputeData } from '../services/api'
import { getCircleDetail, MemberData } from '../services/api'
import { DISPUTE_REASONS, DISPUTE_STATUSES } from '../config'
import { shortenAddress } from '../utils/aleo-utils'

export default function DisputeResolution() {
  const { circleId } = useParams()
  const { connected, address } = useWallet() as any
  const { createDispute, voteOnDispute, resolveDispute, isProcessing, transactionStatus } = useOnChainDispute()

  const [disputes, setDisputes] = useState<DisputeData[]>([])
  const [members, setMembers] = useState<MemberData[]>([])
  const [maxMembers, setMaxMembers] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [newDispute, setNewDispute] = useState({ accused: '', reason: 0, cycle: 1 })
  useEffect(() => {
    if (!circleId) return
    setIsLoading(true)
    Promise.all([
      fetchDisputes(circleId),
      getCircleDetail(circleId),
    ]).then(([disputeData, circleData]) => {
      setDisputes(disputeData)
      setMembers(circleData.members || [])
      setMaxMembers(circleData.circle.maxMembers)
      setIsLoading(false)
    }).catch(() => setIsLoading(false))
  }, [circleId])

  const handleCreateDispute = async () => {
    if (!circleId || !connected) {
      toast.error('Please connect your wallet')
      return
    }
    if (!newDispute.accused) {
      toast.error('Select a member to dispute')
      return
    }

    const result = await createDispute(circleId, newDispute.accused, newDispute.reason, newDispute.cycle)
    if (result.success) {
      toast.success('Dispute created on-chain!')
      if (result.backendWarning) {
        toast.error(`Note: dispute tracking DB error — ${result.backendWarning}. The dispute IS recorded on-chain.`, { duration: 8000 })
      }
      setShowCreateForm(false)
      // Refresh disputes
      const updated = await fetchDisputes(circleId)
      setDisputes(updated)
    } else {
      toast.error(result.error || 'Failed to create dispute')
    }
  }

  const handleVote = async (dispute: DisputeData, voteFor: boolean) => {
    if (!circleId || !connected) {
      toast.error('Please connect your wallet')
      return
    }

    const result = await voteOnDispute(circleId, dispute.disputeId, voteFor)
    if (result.success) {
      toast.success('Vote recorded on-chain!')
      const updated = await fetchDisputes(circleId)
      setDisputes(updated)
    } else {
      toast.error(result.error || 'Failed to vote')
    }
  }

  const handleResolve = async (dispute: DisputeData) => {
    if (!circleId || !connected) {
      toast.error('Please connect your wallet')
      return
    }

    const result = await resolveDispute(circleId, dispute.disputeId)
    if (result.success) {
      toast.success('Dispute resolved on-chain!')
      const updated = await fetchDisputes(circleId)
      setDisputes(updated)
    } else {
      toast.error(result.error || 'Failed to resolve dispute')
    }
  }

  const getQuorum = () => Math.floor((maxMembers - 1) / 2) + 1

  if (isLoading) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-amber-500 animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen py-12 md:py-20">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <Link
            to={`/circle/${circleId}`}
            className="inline-flex items-center gap-2 text-amber-600 hover:text-amber-700 mb-4"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Circle
          </Link>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="font-display text-3xl md:text-4xl font-bold text-midnight-900 mb-2">
                Dispute Resolution
              </h1>
              <p className="text-midnight-600">
                On-chain voting for dispute resolution. Quorum: {getQuorum()} of {maxMembers - 1} eligible voters.
              </p>
            </div>
            {connected && (
              <button
                onClick={() => setShowCreateForm(!showCreateForm)}
                className="btn-primary flex items-center gap-2"
              >
                <Plus className="w-5 h-5" />
                File Dispute
              </button>
            )}
          </div>
        </motion.div>

        {/* Processing Status */}
        {isProcessing && transactionStatus && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center gap-3"
          >
            <Loader2 className="w-5 h-5 text-amber-600 animate-spin flex-shrink-0" />
            <span className="text-amber-800 text-sm">{transactionStatus}</span>
          </motion.div>
        )}

        {/* Create Dispute Form */}
        {showCreateForm && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="card mb-8"
          >
            <h3 className="font-display text-lg font-semibold text-midnight-900 mb-4">
              File a New Dispute
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-midnight-700 mb-1">
                  <Users className="w-4 h-4 inline mr-1" />
                  Accused Member
                </label>
                <select
                  value={newDispute.accused}
                  onChange={(e) => setNewDispute(prev => ({ ...prev, accused: e.target.value }))}
                  className="input"
                >
                  <option value="">Select a member...</option>
                  {members
                    .filter(m => m.address !== address)
                    .map(m => (
                      <option key={m.address} value={m.address}>
                        {shortenAddress(m.address)} (Member #{m.joinOrder})
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-midnight-700 mb-1">
                  <AlertTriangle className="w-4 h-4 inline mr-1" />
                  Reason
                </label>
                <select
                  value={newDispute.reason}
                  onChange={(e) => setNewDispute(prev => ({ ...prev, reason: parseInt(e.target.value) }))}
                  className="input"
                >
                  {DISPUTE_REASONS.map(r => (
                    <option key={r.value} value={r.value}>{r.label} — {r.description}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-midnight-700 mb-1">
                  Cycle Number
                </label>
                <input
                  type="number"
                  min={1}
                  value={newDispute.cycle}
                  onChange={(e) => setNewDispute(prev => ({ ...prev, cycle: parseInt(e.target.value) || 1 }))}
                  className="input"
                />
              </div>

              <div className="flex gap-3">
                <button
                  onClick={handleCreateDispute}
                  disabled={isProcessing || !newDispute.accused}
                  className="btn-primary flex items-center gap-2"
                >
                  {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Gavel className="w-4 h-4" />}
                  Submit Dispute
                </button>
                <button
                  onClick={() => setShowCreateForm(false)}
                  className="btn-secondary"
                >
                  Cancel
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {/* Disputes List */}
        {disputes.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            className="card text-center py-12"
          >
            <Shield className="w-16 h-16 text-green-400 mx-auto mb-4" />
            <h3 className="font-display text-xl font-semibold text-midnight-900 mb-2">
              No Disputes
            </h3>
            <p className="text-midnight-600">This circle has no open or resolved disputes.</p>
          </motion.div>
        ) : (
          <div className="space-y-4">
            {disputes.map((dispute, i) => {
              const statusConfig = DISPUTE_STATUSES[dispute.status as keyof typeof DISPUTE_STATUSES] || DISPUTE_STATUSES[0]
              const reasonConfig = DISPUTE_REASONS.find(r => r.value === dispute.reason) || DISPUTE_REASONS[0]
              const totalVotes = dispute.votesFor + dispute.votesAgainst
              const quorum = getQuorum()
              const canResolve = totalVotes >= quorum && dispute.status === 0
              const hasVoted = dispute.votes?.some(v => v.voter === address)

              return (
                <motion.div
                  key={dispute.disputeId}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="card"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <AlertTriangle className={`w-5 h-5 ${
                          dispute.status === 0 ? 'text-amber-500' :
                          dispute.status === 1 ? 'text-red-500' : 'text-green-500'
                        }`} />
                        <h3 className="font-display font-semibold text-midnight-900">
                          {reasonConfig.label}
                        </h3>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          dispute.status === 0 ? 'bg-amber-100 text-amber-800' :
                          dispute.status === 1 ? 'bg-red-100 text-red-800' :
                          'bg-green-100 text-green-800'
                        }`}>
                          {statusConfig.label}
                        </span>
                      </div>
                      <p className="text-sm text-midnight-600">
                        Against: <span className="font-mono">{shortenAddress(dispute.accused)}</span>
                        {' '}&bull; Cycle {dispute.cycle}
                        {' '}&bull; Filed by <span className="font-mono">{shortenAddress(dispute.reporter)}</span>
                      </p>
                    </div>
                  </div>

                  {/* Vote Progress */}
                  <div className="bg-cream-50 rounded-xl p-4 mb-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-midnight-600">
                        Votes: {totalVotes} / {quorum} needed for resolution
                      </span>
                    </div>
                    <div className="flex gap-4 mb-2">
                      <div className="flex-1">
                        <div className="flex items-center justify-between text-sm mb-1">
                          <span className="text-red-600 flex items-center gap-1">
                            <ThumbsUp className="w-3.5 h-3.5" /> Guilty
                          </span>
                          <span className="font-semibold">{dispute.votesFor}</span>
                        </div>
                        <div className="h-2 bg-cream-200 rounded-full">
                          <div
                            className="h-full bg-red-400 rounded-full transition-all"
                            style={{ width: `${totalVotes > 0 ? (dispute.votesFor / totalVotes) * 100 : 0}%` }}
                          />
                        </div>
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between text-sm mb-1">
                          <span className="text-green-600 flex items-center gap-1">
                            <ThumbsDown className="w-3.5 h-3.5" /> Innocent
                          </span>
                          <span className="font-semibold">{dispute.votesAgainst}</span>
                        </div>
                        <div className="h-2 bg-cream-200 rounded-full">
                          <div
                            className="h-full bg-green-400 rounded-full transition-all"
                            style={{ width: `${totalVotes > 0 ? (dispute.votesAgainst / totalVotes) * 100 : 0}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  {dispute.status === 0 && connected && address !== dispute.accused && (
                    <div className="flex gap-3">
                      {!hasVoted && (
                        <>
                          <button
                            onClick={() => handleVote(dispute, true)}
                            disabled={isProcessing}
                            className="flex-1 flex items-center justify-center gap-2 py-2 px-4 bg-red-50 text-red-700 rounded-xl hover:bg-red-100 transition-colors font-medium text-sm"
                          >
                            <ThumbsUp className="w-4 h-4" /> Vote Guilty
                          </button>
                          <button
                            onClick={() => handleVote(dispute, false)}
                            disabled={isProcessing}
                            className="flex-1 flex items-center justify-center gap-2 py-2 px-4 bg-green-50 text-green-700 rounded-xl hover:bg-green-100 transition-colors font-medium text-sm"
                          >
                            <ThumbsDown className="w-4 h-4" /> Vote Innocent
                          </button>
                        </>
                      )}
                      {canResolve && (
                        <button
                          onClick={() => handleResolve(dispute)}
                          disabled={isProcessing}
                          className="flex items-center justify-center gap-2 py-2 px-4 bg-amber-50 text-amber-700 rounded-xl hover:bg-amber-100 transition-colors font-medium text-sm"
                        >
                          <Gavel className="w-4 h-4" /> Resolve
                        </button>
                      )}
                      {hasVoted && !canResolve && (
                        <p className="text-sm text-midnight-500 flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-green-500" /> You've voted. Waiting for quorum.
                        </p>
                      )}
                    </div>
                  )}

                  {dispute.status !== 0 && (
                    <div className={`flex items-center gap-2 text-sm ${
                      dispute.status === 1 ? 'text-red-600' : 'text-green-600'
                    }`}>
                      {dispute.status === 1 ? (
                        <><XCircle className="w-4 h-4" /> Resolved: Member found guilty</>
                      ) : (
                        <><CheckCircle2 className="w-4 h-4" /> Resolved: Member found innocent</>
                      )}
                    </div>
                  )}
                </motion.div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
