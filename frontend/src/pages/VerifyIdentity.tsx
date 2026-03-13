import { useState } from 'react'
import { useWallet } from '@provablehq/aleo-wallet-adaptor-react'
import { motion } from 'framer-motion'
import { toast } from 'react-hot-toast'
import {
  Mail,
  Shield,
  CheckCircle2,
  Loader2,
  ArrowRight,
  KeyRound,
  BadgeCheck,
  RefreshCw,
} from 'lucide-react'
import { useZkEmailVerification } from '../hooks/useZkEmailVerification'

const steps = [
  { id: 'idle', label: 'Enter Email', icon: Mail },
  { id: 'registering', label: 'On-Chain Registration', icon: Shield },
  { id: 'sending_code', label: 'Verification Code', icon: KeyRound },
  { id: 'verifying', label: 'Verify', icon: BadgeCheck },
  { id: 'done', label: 'Verified', icon: CheckCircle2 },
]

export default function VerifyIdentity() {
  const { connected } = useWallet() as any
  const {
    registerEmail,
    submitVerificationCode,
    resendCode,
    step,
    status,
    testCode,
    isProcessing,
    transactionStatus,
    codeSending,
  } = useZkEmailVerification()

  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')

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

  const handleVerify = async () => {
    if (!code || code.length < 4) {
      toast.error('Enter the verification code')
      return
    }
    const result = await submitVerificationCode(code)
    if (result.success) {
      toast.success('Email verified on-chain!')
    } else {
      toast.error(result.error || 'Verification failed')
    }
  }

  const currentStepIdx = steps.findIndex(s => s.id === step)

  return (
    <div className="min-h-screen bg-cream-50 py-12 md:py-20">
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
            Prove your email ownership on-chain without revealing it. Your email is hashed before being sent to the Aleo network.
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
        ) : !status?.verified && (
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
                  Step 1: Register Email Commitment
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
                      <><Shield className="w-4 h-4" /> Register &amp; Send Code</>
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* Step: Enter Code */}
            {(step === 'sending_code' || step === 'verifying') && (
              <div>
                <h2 className="font-display text-lg font-semibold text-midnight-900 mb-4 flex items-center gap-2">
                  <KeyRound className="w-5 h-5 text-amber-500" />
                  Step 2: Enter Verification Code
                </h2>
                <p className="text-sm text-midnight-600 mb-4">
                  A 6-digit verification code has been generated for your account.
                </p>

                {codeSending ? (
                  <div className="bg-cream-100 border border-amber-200 rounded-xl p-3 mb-4 flex items-center gap-2">
                    <Loader2 className="w-4 h-4 text-amber-500 animate-spin shrink-0" />
                    <p className="text-amber-800 text-sm">Sending your verification code…</p>
                  </div>
                ) : testCode ? (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-4">
                    <p className="text-amber-800 text-sm">
                      <strong>Email delivery unavailable</strong> — your code is shown here:
                      {' '}<code className="bg-amber-100 px-2 py-1 rounded font-mono text-lg font-bold">{testCode}</code>
                    </p>
                    <p className="text-amber-700 text-xs mt-1">To enable real email delivery, verify a domain at resend.com and set <code>RESEND_FROM</code> in Render.</p>
                    <button
                      type="button"
                      onClick={() => { setCode(testCode); }}
                      className="mt-2 text-xs text-amber-700 hover:text-amber-900 underline"
                    >
                      Auto-fill code
                    </button>
                  </div>
                ) : (
                  <div className="bg-green-50 border border-green-200 rounded-xl p-3 mb-4"> {/* codeSending=false, testCode=null → email was sent */}
                    <p className="text-green-800 text-sm mb-2">
                      ✅ Verification code sent to your email. Check your inbox (and spam folder).
                    </p>
                    <button
                      type="button"
                      onClick={() => resendCode()}
                      disabled={isProcessing}
                      className="text-xs text-green-700 font-semibold hover:text-green-900 underline flex items-center gap-1"
                    >
                      {isProcessing ? <><Loader2 className="w-3 h-3 animate-spin" /> Sending...</> : <><RefreshCw className="w-3 h-3" /> Resend code</>}
                    </button>
                  </div>
                )}

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-midnight-700 mb-1">Verification Code</label>
                    <input
                      type="text"
                      value={code}
                      onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      placeholder="123456"
                      className="input text-center font-mono text-2xl tracking-widest"
                      maxLength={6}
                      disabled={isProcessing}
                    />
                  </div>
                  <button
                    onClick={handleVerify}
                    disabled={isProcessing || code.length < 6}
                    className="btn-primary w-full flex items-center justify-center gap-2"
                  >
                    {isProcessing ? (
                      <><Loader2 className="w-4 h-4 animate-spin" /> Verifying...</>
                    ) : (
                      <><ArrowRight className="w-4 h-4" /> Verify on-chain</>
                    )}
                  </button>
                  <button
                    onClick={() => resendCode()}
                    disabled={isProcessing}
                    className="w-full text-sm text-amber-600 hover:text-amber-700 flex items-center justify-center gap-1"
                  >
                    <RefreshCw className="w-3.5 h-3.5" /> Resend code
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
