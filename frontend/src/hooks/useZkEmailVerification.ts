import { useState, useCallback, useEffect } from 'react'
import { useWallet } from '@provablehq/aleo-wallet-adaptor-react'
import { PROGRAM_ID, FEE_EMAIL_REGISTER } from '../config'
import { hashToField } from '../utils/aleo-utils'
import { trackTransaction } from '../utils/transactionTracker'
import {
  registerEmailCommitment,
  checkEmailStatus,
} from '../services/api'
import type { EmailVerificationStatus } from '../services/api'

interface VerificationResult {
  success: boolean
  error?: string
  transactionId?: string
}

export function useZkEmailVerification() {
  const wallet = useWallet() as any
  const { connected, address, executeTransaction } = wallet
  const walletTxStatus: ((id: string) => Promise<{ status?: string; transactionId?: string }>) | undefined =
    wallet.transactionStatus
  const [isProcessing, setIsProcessing] = useState(false)
  const [transactionStatus, setTransactionStatus] = useState<string | null>(null)
  const [status, setStatus] = useState<EmailVerificationStatus>({
    registered: false,
    verified: false,
    status: 0,
  })
  const [step, setStep] = useState<'idle' | 'registering' | 'done'>('idle')

  // Check status on mount — jump straight to done if already verified
  useEffect(() => {
    if (connected && address) {
      // Check localStorage first for instant result
      try {
        if (localStorage.getItem(`zk_verified_${address}`) === 'true') {
          setStatus({ registered: true, verified: true, status: 2 })
          setStep('done')
          return
        }
      } catch { /* ignore */ }
      checkEmailStatus(address).then(s => {
        setStatus(s)
        if (s.verified) setStep('done')
      })
    }
  }, [connected, address])

  const registerEmail = useCallback(async (email: string): Promise<VerificationResult> => {
    if (!connected || !address) return { success: false, error: 'Wallet not connected' }
    if (!executeTransaction) return { success: false, error: 'Wallet does not support transactions' }

    setIsProcessing(true)
    setStep('registering')
    setTransactionStatus('Preparing transaction...')

    try {
      const normalizedEmail = email.toLowerCase().trim()
      const emailHash = await hashToField(normalizedEmail)

      setTransactionStatus('Awaiting wallet approval...')

      // Submit on-chain commitment — await fully like create_circle
      const result = await executeTransaction({
        program: PROGRAM_ID,
        function: 'register_email_commitment',
        inputs: [emailHash],
        fee: FEE_EMAIL_REGISTER,
        privateFee: false,
      })

      const txId = String(result?.transactionId || result)
      console.log('[zkEmail] Transaction ID:', txId)

      // Track on-chain confirmation
      const confirmation = await trackTransaction(txId, setTransactionStatus, 180_000, 6_000, walletTxStatus)

      if (confirmation.status === 'rejected') {
        // If rejected because already registered — that's OK, continue
        const reason = confirmation.rejectionReason || ''
        const alreadyRegistered = reason.includes('contains') || reason.includes('assert')
        if (alreadyRegistered) {
          console.log('[zkEmail] Already registered on-chain, continuing with backend flow')
          setTransactionStatus('Already registered on-chain — continuing...')
        } else {
          setIsProcessing(false)
          setTransactionStatus(null)
          setStep('idle')
          return { success: false, error: `Transaction rejected: ${reason}` }
        }
      }

      if (confirmation.status === 'timeout') {
        setIsProcessing(false)
        setTransactionStatus(null)
        setStep('idle')
        return { success: false, error: `Transaction timed out. Check the Aleo explorer for TX: ${txId.slice(0, 24)}...` }
      }

      setTransactionStatus('Registered on-chain! Finalizing...')

      // Register with backend in background
      try {
        await registerEmailCommitment({
          address,
          emailHash,
          transactionId: confirmation.txId || txId,
          email: normalizedEmail,
        })
      } catch (bgErr) {
        console.error('[zkEmail] Backend register error (non-fatal):', bgErr)
      }

      // Mark verified immediately — on-chain tx is the proof
      setStatus({ registered: true, verified: true, status: 2 })
      setStep('done')
      setIsProcessing(false)
      setTransactionStatus(null)
      try {
        localStorage.setItem(`zk_verified_${address}`, 'true')
        window.dispatchEvent(new Event('zkcircles:verified'))
      } catch { /* ignore */ }

      return { success: true, transactionId: confirmation.txId || txId }
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Registration failed'
      console.error('[zkEmail] Register error:', error)
      setIsProcessing(false)
      setTransactionStatus(null)
      setStep('idle')
      return { success: false, error: msg }
    }
  }, [connected, address, executeTransaction, walletTxStatus])

  const refreshStatus = useCallback(async () => {
    if (!address) return
    const s = await checkEmailStatus(address)
    setStatus(s)
    if (s.verified) setStep('done')
  }, [address])

  return {
    registerEmail,
    refreshStatus,
    isProcessing,
    transactionStatus,
    status,
    step,
  }
}
