import { useState } from 'react'
import { useWallet } from '@provablehq/aleo-wallet-adaptor-react'
import { motion } from 'framer-motion'
import { toast } from 'react-hot-toast'
import {
  Mail,
  Shield,
  CheckCircle2,
  Loader2,
  BadgeCheck,
  KeyRound,
} from 'lucide-react'
import { useZkEmailVerification } from '../hooks/useZkEmailVerification'

const steps = [
  { id: 'idle', label: 'Enter Email', icon: Mail },
  { id: 'registering', label: 'On-Chain Registration', icon: Shield },
  { id: 'done', label: 'Verified', icon: CheckCircle2 },
]

export default function VerifyIdentity() {
  const { connected } = useWallet() as any
  const {
    registerEmail,
    step,
    status,
    isProcessing,
    transactionStatus,
  } = useZkEmailVerification()

  const [email, setEmail] = useState('')

  const handleRegister = async () => {
    if (!email || !email.includes('@')) {
      toast.error('Enter a valid email address')
      return
    }
    const result = await registerEmail(email)
    if (!result.success) {
      toast.error(result.error || 'Registration failed')
    }
  }

  const currentStepIdx = steps.findIndex(s => s.id === step)

  return (
    <div className="min-h-screen py-12 md:py-20">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-10">
          <div className="w-16 h-16 bg-gradient-to-br from-amber-400 to-amber-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Shield className="w-8 h-8 text-white" />
          </div>
          <h1 className="font-display text-3xl md:text-4xl font-bold text-midnight-900 mb-2">
            zkEmail Identity Verification
          </h1>
          <p className="text-midnight-600 max-w-lg mx-auto">
            Commit your email on-chain to prove identity. Your email is hashed locally — only the hash is stored on the Aleo network.
          </p>
        </motion.div>

        {/* Step Progress */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="flex items-center justify-center gap-2 mb-10"
        >
          {steps.map((s, i) => {
            const Icon = s.icon
            const isActive = i === currentStepIdx
            const isCompleted = i < currentStepIdx
            return (
              <div key={s.id} className="flex items-center gap-2">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm transition-colors ${
                  isCompleted ? 'bg-green-500 text-white' :
                  isActive ? 'bg-amber-500 text-white' :
                  'bg-cream-200 text-midnight-400'
                }`}>
                  {isCompleted ? <CheckCircle2 className="w-4 h-4" /> : <Icon className="w-4 h-4" />}
                </div>
                {i < steps.length - 1 && (
                  <div className={`w-8 h-0.5 ${i < currentStepIdx ? 'bg-green-400' : 'bg-cream-200'}`} />
                )}
              </div>
            )
          })}
        </motion.div>

        {/* Processing Banner */}
        {isProcessing && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center gap-3"
          >
            <Loader2 className="w-5 h-5 text-amber-600 animate-spin flex-shrink-0" />
            <span className="text-amber-800 text-sm">{transactionStatus || 'Processing...'}</span>
          </motion.div>
        )}

        {/* Already Verified */}
        {status?.verified && step !== 'done' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="card text-center py-10 mb-6">
            <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-4" />
            <h2 className="font-display text-2xl font-bold text-midnight-900 mb-2">
              Already Verified
            </h2>
            <p className="text-midnight-600">Your email identity is verified on-chain.</p>
          </motion.div>
        )}

        {/* Main Card */}
        {!connected ? (
          <div className="card text-center py-10">
            <Shield className="w-12 h-12 text-midnight-300 mx-auto mb-4" />
            <p className="text-midnight-600">Connect your wallet to verify your identity.</p>
          </div>
        ) : (step === 'done' || !status?.verified) && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="card"
          >
            {/* Step: Enter Email */}
            {(step === 'idle' || step === 'registering') && (
              <div>
                <h2 className="font-display text-lg font-semibold text-midnight-900 mb-4 flex items-center gap-2">
                  <Mail className="w-5 h-5 text-amber-500" />
                  Register Email Commitment
                </h2>
                <p className="text-sm text-midnight-600 mb-4">
                  Your email will be hashed locally. Only the hash is submitted on-chain — your actual email stays private.
                </p>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-midnight-700 mb-1">Email Address</label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      className="input"
                      disabled={isProcessing}
                    />
                  </div>
                  <button
                    onClick={handleRegister}
                    disabled={isProcessing || !email}
                    className="btn-primary w-full flex items-center justify-center gap-2"
                  >
                    {isProcessing ? (
                      <><Loader2 className="w-4 h-4 animate-spin" /> Registering on-chain...</>
                    ) : (
                      <><Shield className="w-4 h-4" /> Verify Identity</>
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* Step: Done */}
            {step === 'done' && (
              <div className="text-center py-6">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 200 }}
                >
                  <CheckCircle2 className="w-20 h-20 text-green-500 mx-auto mb-4" />
                </motion.div>
                <h2 className="font-display text-2xl font-bold text-midnight-900 mb-2">
                  Identity Verified!
                </h2>
                <p className="text-midnight-600 mb-6">
                  Your email identity has been verified on the Aleo network. Circles can now confirm your identity status.
                </p>
                <div className="bg-green-50 border border-green-200 rounded-xl p-4 inline-block">
                  <p className="text-green-800 text-sm flex items-center gap-2">
                    <BadgeCheck className="w-5 h-5" />
                    <span>On-chain verification complete</span>
                  </p>
                </div>
              </div>
            )}
          </motion.div>
        )}

        {/* Info Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-4"
        >
          {[
            { icon: Shield, title: 'Privacy First', desc: 'Only a hash of your email is stored on-chain. No one can reverse it.' },
            { icon: KeyRound, title: 'Zero-Knowledge', desc: 'Verification proves email ownership without revealing the email itself.' },
            { icon: BadgeCheck, title: 'On-Chain Proof', desc: 'Your verified status is immutably recorded on the Aleo network.' },
          ].map((item, i) => (
            <div key={i} className="bg-white/60 rounded-xl p-4 text-center">
              <item.icon className="w-6 h-6 text-amber-500 mx-auto mb-2" />
              <h4 className="font-display font-semibold text-sm text-midnight-900 mb-1">{item.title}</h4>
              <p className="text-xs text-midnight-600">{item.desc}</p>
            </div>
          ))}
        </motion.div>
      </div>
    </div>
  )
}
