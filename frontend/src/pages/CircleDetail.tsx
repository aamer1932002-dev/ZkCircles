import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useWallet } from '@provablehq/aleo-wallet-adaptor-react'
import { motion } from 'framer-motion'
import { toast } from 'react-hot-toast'
import { 
  Users, 
  Clock, 
  Coins,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Copy,
  Trophy,
  Calendar,
  Share2,
  ArrowRightLeft,
  ShieldCheck,
  X,
  UserPlus,
  Trash2
} from 'lucide-react'
import { useCircleDetail } from '../hooks/useCircleDetail'
import { useContribute } from '../hooks/useContribute'
import { useClaimPayout } from '../hooks/useClaimPayout'
import { useTransferMembership } from '../hooks/useTransferMembership'
import { useVerifyMembership } from '../hooks/useVerifyMembership'
import { useJoinCircle } from '../hooks/useJoinCircle'
import { dissolveCircle } from '../services/api'

const statusLabels = {
  0: { label: 'Forming', color: 'badge-amber', description: 'Waiting for members to join' },
  1: { label: 'Active', color: 'badge-forest', description: 'Circle is running' },
  2: { label: 'Completed', color: 'badge-midnight', description: 'All cycles completed' },
  3: { label: 'Cancelled', color: 'badge-terra', description: 'Circle was cancelled' },
}

export default function CircleDetail() {
  const { circleId } = useParams<{ circleId: string }>()
  const navigate = useNavigate()
  const { connected, address } = useWallet()
  const { circle, members, isLoading, fetchCircleDetail } = useCircleDetail()
  const { contribute, isContributing, transactionStatus: contributeStatus } = useContribute()
  const { claimPayout, isClaiming, transactionStatus: claimStatus } = useClaimPayout()
  const { transferMembership, isTransferring, transactionStatus: transferStatus } = useTransferMembership()
  const { checkMembershipLocally, isVerifying } = useVerifyMembership()
  const { joinCircle, isJoining, transactionStatus: joinStatus } = useJoinCircle()
  
  const [copied, setCopied] = useState(false)
  const [showTransferModal, setShowTransferModal] = useState(false)
  const [transferAddress, setTransferAddress] = useState('')
  const [membershipVerified, setMembershipVerified] = useState<boolean | null>(null)
  const [showDissolveModal, setShowDissolveModal] = useState(false)
  const [isDissolving, setIsDissolving] = useState(false)

  useEffect(() => {
    if (circleId) {
      fetchCircleDetail(circleId)
    }
  }, [circleId])

  const handleCopyLink = () => {
    const link = `${window.location.origin}/join/${circleId}`
    navigator.clipboard.writeText(link)
    setCopied(true)
    toast.success('Invite link copied!')
    setTimeout(() => setCopied(false), 2000)
  }

  const handleContribute = async () => {
    if (!circleId || !connected) return
    
    try {
      const result = await contribute(circleId, circle?.contributionAmount || 0)
      if (result.success) {
        toast.success('Contribution successful!')
        fetchCircleDetail(circleId)
      }
    } catch (error) {
      toast.error('Contribution failed. Please try again.')
    }
  }

  const handleClaimPayout = async () => {
    if (!circleId || !connected) return
    
    try {
      const result = await claimPayout(circleId)
      if (result.success) {
        toast.success('Payout claimed successfully!')
        fetchCircleDetail(circleId)
      }
    } catch (error) {
      toast.error('Failed to claim payout. Please try again.')
    }
  }

  const handleTransferMembership = async () => {
    if (!circleId || !connected || !transferAddress) return
    
    try {
      const result = await transferMembership(circleId, transferAddress)
      if (result.success) {
        toast.success('Membership transferred successfully!')
        setShowTransferModal(false)
        setTransferAddress('')
        navigate('/my-circles')
      } else {
        toast.error(result.error || 'Transfer failed')
      }
    } catch (error) {
      toast.error('Failed to transfer membership. Please try again.')
    }
  }

  const handleVerifyMembership = async () => {
    if (!circleId || !connected) return
    
    try {
      const hasMembership = await checkMembershipLocally(circleId)
      setMembershipVerified(hasMembership)
      if (hasMembership) {
        toast.success('Membership verified!')
      } else {
        toast.error('No membership record found for this circle')
      }
    } catch (error) {
      toast.error('Failed to verify membership.')
    }
  }

  const handleJoinCircle = async () => {
    if (!circleId || !connected) return
    
    try {
      const result = await joinCircle(circleId)
      if (result.success) {
        toast.success('Successfully joined the circle!')
        fetchCircleDetail(circleId)
      } else {
        toast.error(result.error || 'Failed to join circle')
      }
    } catch (error) {
      toast.error('Failed to join circle. Please try again.')
    }
  }

  const handleDissolveCircle = async () => {
    if (!circleId || !connected || !address) return
    
    setIsDissolving(true)
    try {
      const result = await dissolveCircle(circleId, address)
      if (result.success) {
        toast.success('Circle dissolved successfully!')
        setShowDissolveModal(false)
        navigate('/my-circles')
      } else {
        toast.error(result.error || 'Failed to dissolve circle')
      }
    } catch (error) {
      toast.error('Failed to dissolve circle. Please try again.')
    } finally {
      setIsDissolving(false)
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-cream-50 flex items-center justify-center">
        <Loader2 className="w-10 h-10 text-amber-500 animate-spin" />
      </div>
    )
  }

  if (!circle) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center"
        >
          <AlertCircle className="w-16 h-16 text-terra-500 mx-auto mb-4" />
          <h2 className="font-display text-2xl font-semibold text-midnight-900 mb-3">
            Circle Not Found
          </h2>
          <p className="text-midnight-600 mb-6">
            This circle doesn't exist or has been removed.
          </p>
          <button
            onClick={() => navigate('/explorer')}
            className="btn-primary"
          >
            Browse Circles
          </button>
        </motion.div>
      </div>
    )
  }

  const status = statusLabels[circle.status as keyof typeof statusLabels]
  const isMember = members.some(m => m.address === address)
  const currentMemberTurn = members.find(m => m.joinOrder === circle.currentCycle)
  const isMyTurn = currentMemberTurn?.address === address
  const myMemberData = members.find(m => m.address === address)
  const hasContributedThisCycle = myMemberData?.contributedCycles?.includes(circle.currentCycle)
  const potSize = (circle.contributionAmount * circle.maxMembers) / 1_000_000
  const progress = circle.status === 1 ? (circle.currentCycle / circle.totalCycles) * 100 : 0

  return (
    <div className="min-h-screen bg-cream-50 py-12 md:py-20">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <h1 className="font-display text-3xl md:text-4xl font-bold text-midnight-900">
                  {circle.name || `Circle ${circleId?.slice(0, 8)}...`}
                </h1>
                <span className={status.color}>{status.label}</span>
              </div>
              <p className="text-midnight-600">{status.description}</p>
            </div>
            
            {circle.status === 0 && (
              <button
                onClick={handleCopyLink}
                className="btn-secondary inline-flex items-center gap-2"
              >
                {copied ? (
                  <CheckCircle2 className="w-5 h-5" />
                ) : (
                  <Share2 className="w-5 h-5" />
                )}
                {copied ? 'Copied!' : 'Share Invite'}
              </button>
            )}
          </div>
        </motion.div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Stats Cards */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="grid grid-cols-2 md:grid-cols-4 gap-4"
            >
              <div className="card text-center">
                <Users className="w-6 h-6 text-amber-500 mx-auto mb-2" />
                <div className="font-display text-2xl font-bold text-midnight-900">
                  {circle.membersJoined}/{circle.maxMembers}
                </div>
                <div className="text-xs text-midnight-500">Members</div>
              </div>
              <div className="card text-center">
                <Coins className="w-6 h-6 text-forest-500 mx-auto mb-2" />
                <div className="font-display text-2xl font-bold text-midnight-900">
                  {potSize.toFixed(2)}
                </div>
                <div className="text-xs text-midnight-500">ALEO per pot</div>
              </div>
              <div className="card text-center">
                <Calendar className="w-6 h-6 text-terra-500 mx-auto mb-2" />
                <div className="font-display text-2xl font-bold text-midnight-900">
                  {circle.currentCycle}/{circle.totalCycles}
                </div>
                <div className="text-xs text-midnight-500">Current Cycle</div>
              </div>
              <div className="card text-center">
                <Clock className="w-6 h-6 text-midnight-500 mx-auto mb-2" />
                <div className="font-display text-2xl font-bold text-midnight-900">
                  {Math.round(circle.cycleDurationBlocks / 24000)}
                </div>
                <div className="text-xs text-midnight-500">Days per cycle</div>
              </div>
            </motion.div>

            {/* Progress */}
            {circle.status === 1 && (
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="card"
              >
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-display text-lg font-semibold text-midnight-900">
                    Circle Progress
                  </h3>
                  <span className="text-sm text-midnight-600">
                    {Math.round(progress)}% complete
                  </span>
                </div>
                <div className="h-4 bg-cream-200 rounded-full overflow-hidden">
                  <motion.div
                    className="h-full bg-gradient-to-r from-amber-400 via-amber-500 to-forest-500 rounded-full"
                    initial={{ width: 0 }}
                    animate={{ width: `${progress}%` }}
                    transition={{ duration: 1, ease: 'easeOut' }}
                  />
                </div>
              </motion.div>
            )}

            {/* Members List */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="card"
            >
              <h3 className="font-display text-lg font-semibold text-midnight-900 mb-4">
                Members ({members.length})
              </h3>
              <div className="space-y-3">
                {members.map((member, index) => {
                  const isCurrentTurn = member.joinOrder === circle.currentCycle && circle.status === 1
                  const hasReceivedPayout = member.hasReceivedPayout
                  
                  return (
                    <div
                      key={`${member.address}-${index}`}
                      className={`flex items-center justify-between p-4 rounded-xl transition-colors ${
                        isCurrentTurn 
                          ? 'bg-forest-50 border-2 border-forest-300' 
                          : 'bg-cream-50'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold ${
                          hasReceivedPayout 
                            ? 'bg-forest-100 text-forest-700' 
                            : isCurrentTurn
                              ? 'bg-forest-500 text-white'
                              : 'bg-amber-100 text-amber-700'
                        }`}>
                          {hasReceivedPayout ? (
                            <CheckCircle2 className="w-5 h-5" />
                          ) : (
                            member.joinOrder
                          )}
                        </div>
                        <div>
                          <div className="font-mono text-sm text-midnight-900">
                            {member.address.slice(0, 10)}...{member.address.slice(-6)}
                            {member.address === address && (
                              <span className="ml-2 text-xs text-amber-600">(You)</span>
                            )}
                          </div>
                          <div className="text-xs text-midnight-500">
                            Position #{member.joinOrder}
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        {isCurrentTurn && (
                          <span className="badge-forest flex items-center gap-1">
                            <Trophy className="w-3 h-3" />
                            Receiving
                          </span>
                        )}
                        {hasReceivedPayout && (
                          <span className="badge-midnight text-xs">Paid</span>
                        )}
                      </div>
                    </div>
                  )
                })}
                
                {/* Empty slots */}
                {Array.from({ length: circle.maxMembers - members.length }).map((_, i) => (
                  <div
                    key={`empty-${i}`}
                    className="flex items-center justify-center p-4 rounded-xl border-2 border-dashed border-cream-300 text-midnight-400"
                  >
                    <Users className="w-5 h-5 mr-2" />
                    Waiting for member...
                  </div>
                ))}
              </div>
            </motion.div>
          </div>

          {/* Sidebar Actions */}
          <div className="lg:col-span-1 space-y-6">
            {/* Join Circle Card - for non-members when forming */}
            {!isMember && circle.status === 0 && circle.membersJoined < circle.maxMembers && (
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="card sticky top-24"
              >
                <h3 className="font-display text-lg font-semibold text-midnight-900 mb-4">
                  Join This Circle
                </h3>
                
                <div className="p-4 bg-forest-50 border border-forest-200 rounded-xl mb-4">
                  <div className="flex items-start gap-3">
                    <Users className="w-5 h-5 text-forest-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm text-forest-800 font-medium">
                        {circle.maxMembers - circle.membersJoined} spots available
                      </p>
                      <p className="text-xs text-forest-700 mt-1">
                        Contribution: {(circle.contributionAmount / 1_000_000).toFixed(3)} ALEO per cycle
                      </p>
                    </div>
                  </div>
                </div>

                {connected ? (
                  <>
                    <button
                      onClick={handleJoinCircle}
                      disabled={isJoining}
                      className="btn-primary w-full flex items-center justify-center gap-2"
                    >
                      {isJoining ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : (
                        <UserPlus className="w-5 h-5" />
                      )}
                      {isJoining ? 'Joining...' : 'Join Circle'}
                    </button>
                    
                    {joinStatus && (
                      <div className="mt-3 p-3 bg-cream-100 rounded-xl">
                        <p className="text-sm text-midnight-700">{joinStatus}</p>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl">
                    <div className="flex items-start gap-3">
                      <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                      <p className="text-sm text-amber-800">
                        Connect your wallet to join this circle
                      </p>
                    </div>
                  </div>
                )}
              </motion.div>
            )}

            {/* Action Card */}
            {isMember && circle.status === 1 && (
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="card sticky top-24"
              >
                <h3 className="font-display text-lg font-semibold text-midnight-900 mb-4">
                  Actions
                </h3>

                {/* Contribute */}
                {!hasContributedThisCycle && !isMyTurn && (
                  <div className="mb-4">
                    <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl mb-4">
                      <div className="flex items-start gap-3">
                        <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="text-sm text-amber-800 font-medium">
                            Contribution Required
                          </p>
                          <p className="text-xs text-amber-700 mt-1">
                            Contribute {(circle.contributionAmount / 1_000_000).toFixed(3)} ALEO for Cycle {circle.currentCycle}
                          </p>
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={handleContribute}
                      disabled={isContributing}
                      className="btn-primary w-full flex items-center justify-center gap-2"
                    >
                      {isContributing ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : (
                        <Coins className="w-5 h-5" />
                      )}
                      Contribute Now
                    </button>
                    
                    {contributeStatus && (
                      <div className="mt-3 p-3 bg-cream-100 rounded-xl">
                        <p className="text-sm text-midnight-700">{contributeStatus}</p>
                      </div>
                    )}
                  </div>
                )}

                {hasContributedThisCycle && !isMyTurn && (
                  <div className="p-4 bg-forest-50 border border-forest-200 rounded-xl mb-4">
                    <div className="flex items-center gap-3">
                      <CheckCircle2 className="w-5 h-5 text-forest-600" />
                      <p className="text-sm text-forest-800 font-medium">
                        You've contributed this cycle!
                      </p>
                    </div>
                  </div>
                )}

                {/* Claim Payout */}
                {isMyTurn && !myMemberData?.hasReceivedPayout && (
                  <div>
                    <div className="p-4 bg-forest-50 border border-forest-200 rounded-xl mb-4">
                      <div className="flex items-start gap-3">
                        <Trophy className="w-5 h-5 text-forest-600 flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="text-sm text-forest-800 font-medium">
                            It's Your Turn!
                          </p>
                          <p className="text-xs text-forest-700 mt-1">
                            Claim your payout of {potSize.toFixed(3)} ALEO
                          </p>
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={handleClaimPayout}
                      disabled={isClaiming}
                      className="btn-forest w-full flex items-center justify-center gap-2"
                    >
                      {isClaiming ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : (
                        <Trophy className="w-5 h-5" />
                      )}
                      Claim Payout
                    </button>
                    
                    {claimStatus && (
                      <div className="mt-3 p-3 bg-cream-100 rounded-xl">
                        <p className="text-sm text-midnight-700">{claimStatus}</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Membership Actions - Transfer & Verify */}
                <div className="border-t border-cream-200 pt-4 mt-4 space-y-3">
                  <h4 className="text-sm font-semibold text-midnight-700 mb-3">Membership Actions</h4>
                  
                  {/* Verify Membership */}
                  <button
                    onClick={handleVerifyMembership}
                    disabled={isVerifying}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-cream-100 hover:bg-cream-200 text-midnight-700 rounded-xl transition-colors text-sm font-medium"
                  >
                    {isVerifying ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : membershipVerified === true ? (
                      <CheckCircle2 className="w-4 h-4 text-forest-600" />
                    ) : membershipVerified === false ? (
                      <AlertCircle className="w-4 h-4 text-terra-600" />
                    ) : (
                      <ShieldCheck className="w-4 h-4" />
                    )}
                    {membershipVerified === true ? 'Membership Verified' : 
                     membershipVerified === false ? 'Not a Member' : 
                     'Verify Membership'}
                  </button>

                  {/* Transfer Membership */}
                  <button
                    onClick={() => setShowTransferModal(true)}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-cream-100 hover:bg-cream-200 text-midnight-700 rounded-xl transition-colors text-sm font-medium"
                  >
                    <ArrowRightLeft className="w-4 h-4" />
                    Transfer Membership
                  </button>
                </div>
              </motion.div>
            )}

            {/* Circle Details */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="card"
            >
              <h3 className="font-display text-lg font-semibold text-midnight-900 mb-4">
                Circle Details
              </h3>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between py-2 border-b border-cream-200">
                  <span className="text-midnight-600">Circle ID</span>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(circleId || '')
                      toast.success('Circle ID copied!')
                    }}
                    className="font-mono text-midnight-900 hover:text-amber-600 flex items-center gap-1"
                  >
                    {circleId?.slice(0, 8)}...
                    <Copy className="w-3 h-3" />
                  </button>
                </div>
                <div className="flex justify-between py-2 border-b border-cream-200">
                  <span className="text-midnight-600">Contribution</span>
                  <span className="font-medium text-midnight-900">
                    {(circle.contributionAmount / 1_000_000).toFixed(3)} ALEO
                  </span>
                </div>
                <div className="flex justify-between py-2 border-b border-cream-200">
                  <span className="text-midnight-600">Pot Size</span>
                  <span className="font-medium text-midnight-900">
                    {potSize.toFixed(3)} ALEO
                  </span>
                </div>
                <div className="flex justify-between py-2 border-b border-cream-200">
                  <span className="text-midnight-600">Total Cycles</span>
                  <span className="font-medium text-midnight-900">
                    {circle.totalCycles}
                  </span>
                </div>
                <div className="flex justify-between py-2">
                  <span className="text-midnight-600">Duration</span>
                  <span className="font-medium text-midnight-900">
                    ~{Math.round(circle.cycleDurationBlocks / 24000 * circle.totalCycles)} days total
                  </span>
                </div>
              </div>

              {/* Dissolve Circle Button - Only for creator when forming */}
              {address && circle.creator === address && circle.status === 0 && (
                <div className="mt-6 pt-4 border-t border-cream-200">
                  <button
                    onClick={() => setShowDissolveModal(true)}
                    className="w-full px-4 py-3 bg-red-50 hover:bg-red-100 border border-red-200 text-red-600 rounded-xl transition-colors font-medium flex items-center justify-center gap-2"
                  >
                    <Trash2 className="w-4 h-4" />
                    Dissolve Circle
                  </button>
                  <p className="text-xs text-midnight-500 mt-2 text-center">
                    Only available while circle is still forming
                  </p>
                </div>
              )}
            </motion.div>
          </div>
        </div>
      </div>

      {/* Transfer Membership Modal */}
      {showTransferModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6"
          >
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-display text-xl font-semibold text-midnight-900">
                Transfer Membership
              </h3>
              <button
                onClick={() => {
                  setShowTransferModal(false)
                  setTransferAddress('')
                }}
                className="p-2 hover:bg-cream-100 rounded-full transition-colors"
              >
                <X className="w-5 h-5 text-midnight-600" />
              </button>
            </div>

            <div className="mb-6">
              <p className="text-sm text-midnight-600 mb-4">
                Transfer your membership in this circle to another Aleo address. 
                This action cannot be undone.
              </p>
              
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl mb-4">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm text-amber-800 font-medium">
                      Warning
                    </p>
                    <p className="text-xs text-amber-700 mt-1">
                      You will lose access to this circle and any future payouts.
                    </p>
                  </div>
                </div>
              </div>

              <label className="block text-sm font-medium text-midnight-700 mb-2">
                New Owner Address
              </label>
              <input
                type="text"
                value={transferAddress}
                onChange={(e) => setTransferAddress(e.target.value)}
                placeholder="aleo1..."
                className="w-full px-4 py-3 border border-cream-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent text-sm font-mono"
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowTransferModal(false)
                  setTransferAddress('')
                }}
                className="flex-1 px-4 py-3 bg-cream-100 hover:bg-cream-200 text-midnight-700 rounded-xl transition-colors font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleTransferMembership}
                disabled={isTransferring || !transferAddress || !transferAddress.startsWith('aleo1')}
                className="flex-1 px-4 py-3 bg-terra-500 hover:bg-terra-600 text-white rounded-xl transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isTransferring ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Transferring...
                  </>
                ) : (
                  <>
                    <ArrowRightLeft className="w-4 h-4" />
                    Transfer
                  </>
                )}
              </button>
            </div>

            {transferStatus && (
              <div className="mt-4 p-3 bg-cream-100 rounded-xl">
                <p className="text-sm text-midnight-700">{transferStatus}</p>
              </div>
            )}
          </motion.div>
        </div>
      )}

      {/* Dissolve Circle Modal */}
      {showDissolveModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6"
          >
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-display text-xl font-semibold text-red-600">
                Dissolve Circle
              </h3>
              <button
                onClick={() => setShowDissolveModal(false)}
                className="p-2 hover:bg-cream-100 rounded-full transition-colors"
              >
                <X className="w-5 h-5 text-midnight-600" />
              </button>
            </div>

            <div className="mb-6">
              <div className="p-4 bg-red-50 border border-red-200 rounded-xl mb-4">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm text-red-800 font-medium">
                      This action cannot be undone
                    </p>
                    <p className="text-xs text-red-700 mt-1">
                      Dissolving this circle will permanently delete it and remove all members.
                      Any members who have joined will need to be notified separately.
                    </p>
                  </div>
                </div>
              </div>

              <p className="text-sm text-midnight-600">
                Are you sure you want to dissolve <span className="font-semibold">"{circle.name}"</span>?
                This circle has <span className="font-semibold">{members.length}</span> member(s).
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowDissolveModal(false)}
                className="flex-1 px-4 py-3 bg-cream-100 hover:bg-cream-200 text-midnight-700 rounded-xl transition-colors font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleDissolveCircle}
                disabled={isDissolving}
                className="flex-1 px-4 py-3 bg-red-500 hover:bg-red-600 text-white rounded-xl transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isDissolving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Dissolving...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    Dissolve
                  </>
                )}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  )
}
