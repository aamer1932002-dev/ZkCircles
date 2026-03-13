import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useWallet } from '@provablehq/aleo-wallet-adaptor-react'
import { motion } from 'framer-motion'
import { toast } from 'react-hot-toast'
import {
  Users,
  ArrowRight,
  Loader2,
  Coins,
  CheckCircle2,
  AlertCircle,
  Link2,
} from 'lucide-react'
import { useJoinCircle } from '../hooks/useJoinCircle'
import { useInviteLinks } from '../hooks/useInviteLinks'
import { getTokenConfig } from '../config'
import type { InviteData } from '../services/api'

export default function InviteAccept() {
  const { code } = useParams()
  const navigate = useNavigate()
  const { connected } = useWallet()
  const { joinCircle, isJoining } = useJoinCircle()
  const { checkInvite, redeemInvite } = useInviteLinks()

  const [invite, setInvite] = useState<InviteData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!code) return
    setIsLoading(true)
    checkInvite(code).then(data => {
      if (!data) {
        setError('Invite link not found or has expired.')
      } else if (!data.valid) {
        setError('This invite link has expired or reached its maximum uses.')
      } else {
        setInvite(data)
      }
      setIsLoading(false)
    })
  }, [code, checkInvite])

  const handleJoin = async () => {
    if (!connected) {
      toast.error('Please connect your wallet first')
      return
    }
    if (!invite || !code) return

    try {
      const result = await joinCircle(invite.circleId, invite.contributionAmount)
      if (result.success) {
        await redeemInvite(code)
        toast.success('Successfully joined the circle!')
        navigate(`/circle/${invite.circleId}`)
      }
    } catch (err) {
      console.error('Failed to join via invite:', err)
      toast.error('Failed to join circle. Please try again.')
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-amber-500 animate-spin" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center px-4">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center">
          <AlertCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />
          <h2 className="font-display text-2xl font-semibold text-midnight-900 mb-3">Invalid Invite</h2>
          <p className="text-midnight-600 mb-6">{error}</p>
          <button onClick={() => navigate('/explorer')} className="btn-primary">
            Browse Circles
          </button>
        </motion.div>
      </div>
    )
  }

  if (!invite) return null

  const tokenConfig = getTokenConfig(invite.tokenId)
  const spotsLeft = invite.maxMembers - invite.membersJoined

  return (
    <div className="min-h-screen bg-cream-50 py-12 md:py-20">
      <div className="max-w-lg mx-auto px-4 sm:px-6">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          {/* Invite card */}
          <div className="card text-center">
            <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <Link2 className="w-8 h-8 text-amber-600" />
            </div>

            <h1 className="font-display text-2xl font-bold text-midnight-900 mb-2">
              You're Invited!
            </h1>
            <p className="text-midnight-600 mb-6">
              {invite.circleName
                ? `Join "${invite.circleName}" savings circle`
                : 'Join this savings circle'}
            </p>

            {/* Circle details */}
            <div className="bg-cream-50 rounded-xl p-4 mb-6 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-midnight-500 flex items-center gap-2">
                  <Coins className="w-4 h-4" /> Contribution
                </span>
                <span className="font-semibold text-midnight-900">
                  {(invite.contributionAmount / 1_000_000).toFixed(3)} {tokenConfig.symbol}/cycle
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-midnight-500 flex items-center gap-2">
                  <Users className="w-4 h-4" /> Members
                </span>
                <span className="font-semibold text-midnight-900">
                  {invite.membersJoined}/{invite.maxMembers}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-midnight-500">Spots Left</span>
                <span className={`font-semibold ${spotsLeft <= 2 ? 'text-red-600' : 'text-green-600'}`}>
                  {spotsLeft}
                </span>
              </div>
            </div>

            {!connected ? (
              <div className="text-center">
                <p className="text-midnight-600 mb-4">
                  Connect your wallet to join this circle.
                </p>
              </div>
            ) : (
              <button
                onClick={handleJoin}
                disabled={isJoining || spotsLeft <= 0}
                className="btn-primary w-full flex items-center justify-center gap-2"
              >
                {isJoining ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Joining...
                  </>
                ) : spotsLeft <= 0 ? (
                  'Circle is Full'
                ) : (
                  <>
                    <CheckCircle2 className="w-5 h-5" />
                    Join Circle
                    <ArrowRight className="w-5 h-5" />
                  </>
                )}
              </button>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  )
}
