import { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
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
  Trash2,
  BarChart2,
  Flag,
  Link2,
  Gavel,
  LayoutDashboard,
} from 'lucide-react'
import { useCircleDetail } from '../hooks/useCircleDetail'
import { useContribute } from '../hooks/useContribute'
import { useClaimPayout } from '../hooks/useClaimPayout'
import { useContributeToken } from '../hooks/useContributeToken'
import { useClaimPayoutToken } from '../hooks/useClaimPayoutToken'
import { useTransferMembership } from '../hooks/useTransferMembership'
import { useVerifyMembership } from '../hooks/useVerifyMembership'
import { useDisputeResolution } from '../hooks/useDisputeResolution'
import { useJoinCircle } from '../hooks/useJoinCircle'
import { useInviteLinks } from '../hooks/useInviteLinks'
import { QRCodeSVG } from 'qrcode.react'
import { dissolveCircle } from '../services/api'
import NotificationBanner, { NotificationToggle } from '../components/NotificationBanner'
import { useNotifications } from '../hooks/useNotifications'
import { getTokenConfig, TOKEN_ID_ALEO } from '../config'
import PageTransition from '../components/PageTransition'

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
  const { circle, members, isLoading, fetchCircleDetail, onChainStatus } = useCircleDetail()
  const { contribute, isContributing, transactionStatus: contributeStatus } = useContribute()
  const { claimPayout, isClaiming, transactionStatus: claimStatus } = useClaimPayout()
  const { contributeToken, isContributing: isContributingToken, transactionStatus: contributeTokenStatus } = useContributeToken()
  const { claimPayoutToken, isClaiming: isClaimingToken } = useClaimPayoutToken()
  const { transferMembership, isTransferring, transactionStatus: transferStatus } = useTransferMembership()
  const { verifyMembership, isVerifying } = useVerifyMembership()
  const { flagMissedContribution, isFlagging } = useDisputeResolution()
  const { joinCircle, isJoining, transactionStatus: joinStatus } = useJoinCircle()
  const { notifyPayoutTurn, notifyContributionDue, notifyCircleFull, isCircleEnabled } = useNotifications()
  const { generateInvite, copyInviteLink, isCreating: isGeneratingInvite } = useInviteLinks()
  const notifiedRef = useRef<Set<string>>(new Set())

  const [copied, setCopied] = useState(false)
  const [showTransferModal, setShowTransferModal] = useState(false)
  const [transferAddress, setTransferAddress] = useState('')
  const [membershipVerified, setMembershipVerified] = useState<boolean | null>(null)
  const [showDissolveModal, setShowDissolveModal] = useState(false)
  const [isDissolving, setIsDissolving] = useState(false)
  const [qrInviteLink, setQrInviteLink] = useState<string | null>(null)

  useEffect(() => {
    if (circleId) {
      fetchCircleDetail(circleId)
    }
  }, [circleId])

  // Fire browser notifications when circle data loads and notifications are enabled
  useEffect(() => {
    if (!circle || !circleId || !address || circle.status !== 1) return
    if (!isCircleEnabled(circleId)) return
    const myMember = members.find(m => m.address === address)
    const myTurn = members.find(m => m.joinOrder === circle.currentCycle)?.address === address
    const hasContributed = myMember?.contributedCycles?.includes(circle.currentCycle)
    if (myTurn) {
      const key = `payout-${circleId}-${circle.currentCycle}`
      if (!notifiedRef.current.has(key)) {
        notifiedRef.current.add(key)
        notifyPayoutTurn(
          circle.name || `Circle ${circleId.slice(0, 8)}`,
          circle.contributionAmount * circle.maxMembers,
        )
      }
    } else if (myMember && !hasContributed) {
      const key = `contrib-${circleId}-${circle.currentCycle}`
      if (!notifiedRef.current.has(key)) {
        notifiedRef.current.add(key)
        notifyContributionDue(
          circle.name || `Circle ${circleId.slice(0, 8)}`,
          circle.contributionAmount,
          0,
        )
      }
    }
  }, [circle, members, circleId, address, isCircleEnabled])

  const handleCopyLink = () => {
    const link = `${window.location.origin}/join/${circleId}`
    navigator.clipboard.writeText(link)
    setCopied(true)
    toast.success('Invite link copied!')
    setTimeout(() => setCopied(false), 2000)
  }

  const handleContribute = async () => {
    if (!circleId || !connected || !circle) return
    const tokenId = circle.tokenId ?? TOKEN_ID_ALEO
    const result = tokenId !== TOKEN_ID_ALEO
      ? await contributeToken(circleId, circle.contributionAmount, tokenId)
      : await contribute(circleId, circle.contributionAmount)
    if (result.success) {
      toast.success('Contribution confirmed on-chain!')
      fetchCircleDetail(circleId)
    } else if (result.error) {
      toast.error(result.error, { duration: 8000 })
    }
  }

  const handleClaimPayout = async () => {
    if (!circleId || !connected || !circle) return
    const tokenId = circle.tokenId ?? TOKEN_ID_ALEO
    const result = tokenId !== TOKEN_ID_ALEO
      ? await claimPayoutToken(circleId, tokenId)
      : await claimPayout(circleId)
    if (result.success) {
      toast.success('Payout confirmed on-chain!')
      fetchCircleDetail(circleId)
    } else if (result.error) {
      toast.error(result.error, { duration: 8000 })
    }
  }

  const handleTransferMembership = async () => {
    if (!circleId || !connected || !transferAddress) return
    const result = await transferMembership(circleId, transferAddress)
    if (result.success) {
      toast.success('Transfer confirmed on-chain!')
      setShowTransferModal(false)
      setTransferAddress('')
      fetchCircleDetail(circleId)
    } else if (result.error) {
      toast.error(result.error, { duration: 8000 })
    }
  }

  const handleVerifyMembership = async () => {
    if (!circleId || !connected) return
    try {
      const result = await verifyMembership(circleId)
      if (result.success && result.isVerified) {
        setMembershipVerified(true)
        toast.success(`Membership verified on-chain! TX: ${result.transactionId?.slice(0, 12)}...`)
      } else {
        setMembershipVerified(false)
        toast.error(result.error || 'Membership not verified')
      }
    } catch (error) {
      toast.error('On-chain verification failed.')
    }
  }

  const handleFlagMissed = async (defaulterAddress: string, cycle: number) => {
    if (!circleId || !connected) return
    const result = await flagMissedContribution(circleId, defaulterAddress, cycle)
    if (result.success) {
      toast.success(`Missed payment flagged on-chain! TX: ${result.transactionId?.slice(0, 12)}...`)
    } else {
      toast.error(result.error || 'Failed to flag missed payment')
    }
  }

  const handleJoinCircle = async () => {
    if (!circleId || !connected) return
    const willBeFull = circle && (circle.membersJoined + 1 >= circle.maxMembers)
    const result = await joinCircle(circleId, circle?.contributionAmount ?? 0)
    if (result.success) {
      toast.success('Joined circle — confirmed on-chain!')
      if (willBeFull && isCircleEnabled(circleId)) {
        notifyCircleFull(circle?.name || `Circle ${circleId.slice(0, 8)}`)
      }
      fetchCircleDetail(circleId)
    } else if (result.error) {
      toast.error(result.error, { duration: 8000 })
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
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-10 h-10 text-amber-500 animate-spin" />
      </div>
    )
  }

  if (!circle) {
    return (
      <PageTransition>
      <div className="min-h-[70vh] flex items-center justify-center px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ease: [0.25, 0.4, 0.25, 1] }}
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
      </PageTransition>
    )
  }

  const status = statusLabels[circle.status as keyof typeof statusLabels]
  const isMember = members.some(m => m.address === address)
  const currentMemberTurn = members.find(m => m.joinOrder === circle.currentCycle)
  const isMyTurn = currentMemberTurn?.address === address
  const myMemberData = members.find(m => m.address === address)
  const hasContributedThisCycle = myMemberData?.contributedCycles?.includes(circle.currentCycle)
  const contributorsThisCycle = members.filter(m => m.contributedCycles?.includes(circle.currentCycle)).length
  const allContributedThisCycle = circle.status === 1 && contributorsThisCycle >= circle.maxMembers
  const potSize = (circle.contributionAmount * circle.maxMembers) / 1_000_000
  const progress = circle.status === 1 ? (circle.currentCycle / circle.totalCycles) * 100 : 0
  const tokenConfig = getTokenConfig(circle.tokenId)
  const tokenSymbol = tokenConfig.symbol

  // Members who have missed at least one past cycle — shown in the dispute panel
  const membersWithMissedCycles = circle.status === 1 && circle.currentCycle > 1
    ? members.filter(m => {
        if (m.address === address) return false // don't flag yourself
        const missedCycles: number[] = []
        for (let c = 1; c < circle.currentCycle; c++) {
          if (!m.contributedCycles?.includes(c)) missedCycles.push(c)
        }
        return missedCycles.length > 0
      }).map(m => {
        const missed: number[] = []
        for (let c = 1; c < circle.currentCycle; c++) {
          if (!m.contributedCycles?.includes(c)) missed.push(c)
        }
        return { ...m, missedCycles: missed }
      })
    : []

  return (
    <PageTransition>
    <div className="min-h-screen py-12 md:py-20">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ease: [0.25, 0.4, 0.25, 1] }}
          className="mb-8"
        >
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <h1 className="font-display text-3xl md:text-4xl font-bold text-midnight-900">
                  {circle.name || `Circle ${circleId?.slice(0, 8)}...`}
                </h1>
                <span className={status.color}>{status.label}</span>
                {onChainStatus === 'synced' && (
                  <span className="inline-flex items-center gap-1 text-xs text-forest-600 bg-forest-50 px-2 py-1 rounded-full">
                    <CheckCircle2 className="w-3 h-3" /> On-chain
                  </span>
                )}
                {onChainStatus === 'syncing' && (
                  <span className="inline-flex items-center gap-1 text-xs text-amber-600 bg-amber-50 px-2 py-1 rounded-full">
                    <Loader2 className="w-3 h-3 animate-spin" /> Syncing…
                  </span>
                )}
                {onChainStatus === 'unavailable' && (
                  <span className="inline-flex items-center gap-1 text-xs text-midnight-500 bg-cream-100 px-2 py-1 rounded-full">
                    Backend only
                  </span>
                )}
                {circleId && <NotificationToggle circleId={circleId} circleName={circle.name || circleId} />}
              </div>
              <p className="text-midnight-600">{status.description}</p>
            </div>
            
            {circle.status === 0 && (
              <div className="flex gap-2 flex-wrap">
                <button
                  onClick={handleCopyLink}
                  className="btn-secondary inline-flex items-center gap-2"
                >
                  {copied ? (
                    <CheckCircle2 className="w-5 h-5" />
                  ) : (
                    <Share2 className="w-5 h-5" />
                  )}
                  {copied ? 'Copied!' : 'Share Link'}
                </button>
                <button
                  onClick={async () => {
                    if (!circleId) return
                    const result = await generateInvite(circleId)
                    if (result.success && result.code) {
                      await copyInviteLink(result.code)
                      setQrInviteLink(result.link || `${window.location.origin}/invite/${result.code}`)
                      toast.success('Invite link copied!')
                    } else {
                      toast.error(result.error || 'Failed to generate invite')
                    }
                  }}
                  disabled={isGeneratingInvite}
                  className="btn-secondary inline-flex items-center gap-2"
                >
                  {isGeneratingInvite ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link2 className="w-4 h-4" />}
                  Invite Link
                </button>
              </div>
            )}
            {/* Quick links */}
            <div className="flex gap-2 flex-wrap">
              {circleId && (
                <>
                  <Link
                    to={`/analytics/${circleId}`}
                    className="btn-secondary inline-flex items-center gap-2 text-sm"
                  >
                    <BarChart2 className="w-4 h-4" />
                    Analytics
                  </Link>
                  <Link
                    to={`/dashboard/${circleId}`}
                    className="btn-secondary inline-flex items-center gap-2 text-sm"
                  >
                    <LayoutDashboard className="w-4 h-4" />
                    Dashboard
                  </Link>
                  {circle.status === 1 && isMember && (
                    <Link
                      to={`/disputes/${circleId}`}
                      className="btn-secondary inline-flex items-center gap-2 text-sm"
                    >
                      <Gavel className="w-4 h-4" />
                      Disputes
                    </Link>
                  )}
                </>
              )}
            </div>
          </div>
        </motion.div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Notification opt-in banner — only shown when notifications are not yet enabled */}
            {circleId && circle.status === 1 && isMember && (
              <NotificationBanner circleId={circleId} circleName={circle.name || circleId} />
            )}
            {/* Stats Cards */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1, ease: [0.25, 0.4, 0.25, 1] }}
              className="grid grid-cols-2 md:grid-cols-4 gap-4"
            >
              <div className="card text-center group hover:-translate-y-1 transition-all duration-300">
                <Users className="w-6 h-6 text-amber-500 mx-auto mb-2 group-hover:scale-110 transition-transform" />
                <div className="font-display text-2xl font-bold text-midnight-900">
                  {circle.membersJoined}/{circle.maxMembers}
                </div>
                <div className="text-xs text-midnight-500">Members</div>
              </div>
              <div className="card text-center group hover:-translate-y-1 transition-all duration-300">
                <Coins className="w-6 h-6 text-forest-500 mx-auto mb-2 group-hover:scale-110 transition-transform" />
                <div className="font-display text-2xl font-bold text-midnight-900">
                  {potSize.toFixed(2)}
                </div>
                <div className="text-xs text-midnight-500">{tokenSymbol} per pot</div>
              </div>
              <div className="card text-center group hover:-translate-y-1 transition-all duration-300">
                <Calendar className="w-6 h-6 text-terra-500 mx-auto mb-2 group-hover:scale-110 transition-transform" />
                <div className="font-display text-2xl font-bold text-midnight-900">
                  {circle.currentCycle}/{circle.totalCycles}
                </div>
                <div className="text-xs text-midnight-500">Current Cycle</div>
              </div>
              <div className="card text-center group hover:-translate-y-1 transition-all duration-300">
                <Clock className="w-6 h-6 text-midnight-500 mx-auto mb-2 group-hover:scale-110 transition-transform" />
                <div className="font-display text-2xl font-bold text-midnight-900">
                  {circle.totalCycles ?? circle.maxMembers}
                </div>
                <div className="text-xs text-midnight-500">Total Cycles</div>
              </div>
            </motion.div>

            {/* Progress */}
            {circle.status === 1 && (
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2, ease: [0.25, 0.4, 0.25, 1] }}
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
              transition={{ delay: 0.3, ease: [0.25, 0.4, 0.25, 1] }}
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
                        Contribution: {(circle.contributionAmount / 1_000_000).toFixed(3)} {tokenSymbol} per cycle
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

                {/* Contribute — show whenever the member hasn't contributed yet,
                    including when it's their turn to claim (they must contribute
                    before they can claim their payout) */}
                {!hasContributedThisCycle && (
                  <div className="mb-4">
                    <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl mb-4">
                      <div className="flex items-start gap-3">
                        <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="text-sm text-amber-800 font-medium">
                            {isMyTurn ? 'Contribute First, Then Claim' : 'Contribution Required'}
                          </p>
                          <p className="text-xs text-amber-700 mt-1">
                            {isMyTurn
                              ? `You must also contribute ${(circle.contributionAmount / 1_000_000).toFixed(3)} ALEO for Cycle ${circle.currentCycle} before you can claim your payout.`
                              : `Contribute ${(circle.contributionAmount / 1_000_000).toFixed(3)} ALEO for Cycle ${circle.currentCycle}`}
                          </p>
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={handleContribute}
                      disabled={isContributing || isContributingToken}
                      className="btn-primary w-full flex items-center justify-center gap-2"
                    >
                      {isContributing || isContributingToken ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : (
                        <Coins className="w-5 h-5" />
                      )}
                      {isMyTurn ? 'Contribute (Required Before Claiming)' : 'Contribute Now'}
                    </button>
                    
                    {(contributeStatus || contributeTokenStatus) && (
                      <div className="mt-3 p-3 bg-cream-100 rounded-xl">
                        <p className="text-sm text-midnight-700">{contributeStatus || contributeTokenStatus}</p>
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
                    {/* Contribution progress */}
                    <div className={`p-4 border rounded-xl mb-4 ${allContributedThisCycle ? 'bg-forest-50 border-forest-200' : 'bg-amber-50 border-amber-200'}`}>
                      <div className="flex items-start gap-3">
                        {allContributedThisCycle ? (
                          <Trophy className="w-5 h-5 text-forest-600 flex-shrink-0 mt-0.5" />
                        ) : (
                          <Clock className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-medium ${allContributedThisCycle ? 'text-forest-800' : 'text-amber-800'}`}>
                            {allContributedThisCycle
                              ? "It's Your Turn — Ready to Claim!"
                              : !hasContributedThisCycle
                              ? 'You Need to Contribute Before Claiming'
                              : 'Waiting for Other Members to Contribute'}
                          </p>
                          <p className={`text-xs mt-1 ${allContributedThisCycle ? 'text-forest-700' : 'text-amber-700'}`}>
                            {allContributedThisCycle
                              ? `Claim your payout of ${potSize.toFixed(3)} ${tokenSymbol}`
                              : !hasContributedThisCycle
                              ? `Contribute ${(circle.contributionAmount / 1_000_000).toFixed(3)} ${tokenSymbol} above first, then all ${circle.maxMembers} members must contribute before you can claim.`
                              : `${contributorsThisCycle} of ${circle.maxMembers} members have contributed for cycle ${circle.currentCycle}. Waiting for the remaining ${circle.maxMembers - contributorsThisCycle} member(s).`}
                          </p>
                          {/* Progress bar */}
                          <div className="mt-2 h-1.5 bg-white/60 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${allContributedThisCycle ? 'bg-forest-500' : 'bg-amber-400'}`}
                              style={{ width: `${Math.round((contributorsThisCycle / circle.maxMembers) * 100)}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={handleClaimPayout}
                      disabled={isClaiming || isClaimingToken || !allContributedThisCycle}
                      className="btn-forest w-full flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isClaiming || isClaimingToken ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : (
                        <Trophy className="w-5 h-5" />
                      )}
                      {allContributedThisCycle ? 'Claim Payout' : `Waiting for contributions (${contributorsThisCycle}/${circle.maxMembers})`}
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
                  
                  {/* Verify Membership — on-chain proof */}
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
                    {membershipVerified === true ? 'Membership Verified On-Chain' :
                     membershipVerified === false ? 'Not a Member' :
                     'Verify Membership (On-Chain)'}
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

            {/* Dispute Resolution Panel — only visible when there are flaggable missed payments */}
            {isMember && membersWithMissedCycles.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.48 }}
                className="card border border-terra-200 bg-terra-50"
              >
                <div className="flex items-center gap-2 mb-4">
                  <Flag className="w-5 h-5 text-terra-600" />
                  <h3 className="font-display text-base font-semibold text-terra-800">
                    Missed Payments
                  </h3>
                </div>
                <p className="text-xs text-terra-700 mb-4">
                  The following members skipped at least one cycle. You can flag missed payments on-chain — this creates a permanent verifiable record and increments the defaulter's on-chain counter.
                </p>
                <div className="space-y-3">
                  {membersWithMissedCycles.map(m => (
                    <div key={m.address} className="p-3 rounded-xl bg-white border border-terra-200">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <p className="font-mono text-xs text-midnight-700 break-all">
                          {m.address.slice(0, 14)}…{m.address.slice(-6)}
                        </p>
                        <span className="shrink-0 text-xs font-bold text-terra-600 bg-terra-100 px-2 py-0.5 rounded-full">
                          {m.missedCycles.length} missed
                        </span>
                      </div>
                      <p className="text-xs text-midnight-500 mb-3">
                        Cycles: {m.missedCycles.join(', ')}
                      </p>
                      {m.missedCycles.map(cycle => (
                        <button
                          key={cycle}
                          onClick={() => handleFlagMissed(m.address, cycle)}
                          disabled={isFlagging}
                          className="mr-2 mb-1 inline-flex items-center gap-1 px-3 py-1 text-xs font-medium bg-terra-100 hover:bg-terra-200 text-terra-700 rounded-lg transition-colors disabled:opacity-50"
                        >
                          {isFlagging ? <Loader2 className="w-3 h-3 animate-spin" /> : <Flag className="w-3 h-3" />}
                          Flag cycle {cycle}
                        </button>
                      ))}
                    </div>
                  ))}
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
                    {(circle.contributionAmount / 1_000_000).toFixed(3)} {tokenSymbol}
                  </span>
                </div>
                <div className="flex justify-between py-2 border-b border-cream-200">
                  <span className="text-midnight-600">Pot Size</span>
                  <span className="font-medium text-midnight-900">
                    {potSize.toFixed(3)} {tokenSymbol}
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
                    ~{circle.totalCycles ?? circle.maxMembers} cycles total
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
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
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
      {/* QR Code Invite Modal */}
      {qrInviteLink && (
        <div className="fixed inset-0 bg-midnight-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6 text-center"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display text-lg font-semibold text-midnight-900">Invite via QR Code</h3>
              <button onClick={() => setQrInviteLink(null)} className="p-1 hover:bg-cream-100 rounded-lg transition-colors">
                <X className="w-5 h-5 text-midnight-500" />
              </button>
            </div>
            <div className="bg-white p-4 rounded-xl inline-block mb-4 border border-cream-200">
              <QRCodeSVG
                value={qrInviteLink}
                size={200}
                bgColor="#FFFFFF"
                fgColor="#2C241F"
                level="M"
                includeMargin={false}
              />
            </div>
            <p className="text-sm text-midnight-600 mb-4">
              Scan this QR code to join the circle
            </p>
            <div className="flex items-center gap-2 p-2 bg-cream-50 rounded-lg mb-4">
              <input
                type="text"
                readOnly
                value={qrInviteLink}
                className="flex-1 bg-transparent text-xs text-midnight-600 font-mono outline-none truncate"
              />
              <button
                onClick={async () => {
                  await navigator.clipboard.writeText(qrInviteLink)
                  toast.success('Link copied!')
                }}
                className="p-1.5 hover:bg-cream-200 rounded-lg transition-colors"
              >
                <Copy className="w-4 h-4 text-midnight-500" />
              </button>
            </div>
            <button
              onClick={() => setQrInviteLink(null)}
              className="btn-secondary w-full"
            >
              Done
            </button>
          </motion.div>
        </div>
      )}

      {showDissolveModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
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
    </PageTransition>
  )
}
