import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useWallet } from '@provablehq/aleo-wallet-adaptor-react'
import { checkEmailStatus } from '../services/api'

interface VerifyIdGateProps {
  children: React.ReactNode
}

function getCachedVerified(address: string): boolean {
  try {
    return localStorage.getItem(`zk_verified_${address}`) === 'true'
  } catch { return false }
}

function setCachedVerified(address: string) {
  try { localStorage.setItem(`zk_verified_${address}`, 'true') } catch { /* ignore */ }
}

export default function VerifyIdGate({ children }: VerifyIdGateProps) {
  const { connected, address } = useWallet() as any
  const navigate = useNavigate()
  const [checking, setChecking] = useState(true)
  const [verified, setVerified] = useState(false)

  useEffect(() => {
    if (!connected || !address) {
      setChecking(false)
      setVerified(false)
      return
    }

    // If we already cached verified for this address, skip the API call
    if (getCachedVerified(address)) {
      setVerified(true)
      setChecking(false)
      return
    }

    let cancelled = false
    setChecking(true)

    checkEmailStatus(address).then((status) => {
      if (cancelled) return
      const isVerified = status.verified === true
      if (isVerified) setCachedVerified(address)
      setVerified(isVerified)
      setChecking(false)
    })

    return () => { cancelled = true }
  }, [connected, address])

  if (!connected) {
    return (
      <div className="max-w-lg mx-auto text-center py-20">
        <div className="text-5xl mb-4">🔒</div>
        <h2 className="text-2xl font-bold text-midnight-800 mb-2">Wallet Required</h2>
        <p className="text-midnight-600">Please connect your wallet to access this feature.</p>
      </div>
    )
  }

  if (checking) {
    return (
      <div className="max-w-lg mx-auto text-center py-20">
        <div className="animate-spin h-8 w-8 border-4 border-amber-500 border-t-transparent rounded-full mx-auto mb-4" />
        <p className="text-midnight-600">Checking verification status...</p>
      </div>
    )
  }

  if (!verified) {
    return (
      <div className="max-w-lg mx-auto text-center py-20">
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-8">
          <div className="text-5xl mb-4">🛡️</div>
          <h2 className="text-2xl font-bold text-midnight-800 mb-2">Identity Verification Required</h2>
          <p className="text-midnight-600 mb-6">
            You need to verify your identity before you can use this feature.
            This helps keep ZkCircles safe and trustworthy for all members.
          </p>
          <button
            onClick={() => navigate('/verify-identity')}
            className="bg-gradient-to-r from-amber-500 to-amber-600 text-white px-8 py-3 rounded-xl font-semibold hover:from-amber-600 hover:to-amber-700 transition-all shadow-lg"
          >
            Verify Identity
          </button>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
