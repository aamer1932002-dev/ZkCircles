import { useState, useCallback, useEffect } from 'react'
import { useWallet } from '@provablehq/aleo-wallet-adaptor-react'
import { PROGRAM_ID, FEE_EMAIL_REGISTER, FEE_EMAIL_VERIFY } from '../config'
import { hashToField } from '../utils/aleo-utils'
import { trackTransaction } from '../utils/transactionTracker'
import {
  registerEmailCommitment,
  sendEmailVerificationCode,
  verifyEmailCode,
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
  const [step, setStep] = useState<'idle' | 'registering' | 'sending_code' | 'verifying' | 'done'>('idle')
  const [testCode, setTestCode] = useState<string | null>(null)
  const [emailForVerify, setEmailForVerify] = useState<string | null>(null)

  // Check status on mount — jump straight to done if already verified
  useEffect(() => {
    if (connected && address) {
      checkEmailStatus(address).then(s => {
        setStatus(s)
        if (s.verified) setStep('done')
        else if (s.registered) setStep('sending_code')
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
      setEmailForVerify(normalizedEmail)

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

      setTransactionStatus('Registered on-chain! Sending verification code...')

      // Register with backend
      await registerEmailCommitment({
        address,
        emailHash,
        transactionId: confirmation.txId || txId,
        email: normalizedEmail,
      })

      // Fetch the code BEFORE switching step — so testCode is in state when the UI renders
      const codeResult = await sendEmailVerificationCode(address)
      if (codeResult.testCode) {
        setTestCode(codeResult.testCode)
      }

      // NOW switch step — testCode is already set, UI will show it immediately
      setStatus(prev => ({ ...prev, registered: true, status: 1 }))
      setStep('sending_code')

      setIsProcessing(false)
      setTransactionStatus(null)
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

  const submitVerificationCode = useCallback(async (code: string): Promise<VerificationResult> => {
    if (!connected || !address) return { success: false, error: 'Wallet not connected' }

    setIsProcessing(true)
    setStep('verifying')
    setTransactionStatus('Verifying code...')

    try {
      // Verify code with backend first
      const result = await verifyEmailCode({ address, code })
      if (!result.verified) {
        setIsProcessing(false)
        setTransactionStatus(null)
        setStep('sending_code')
        return { success: false, error: result.error || 'Invalid code' }
      }

      // Confirm on-chain using the stored email hash
      if (executeTransaction && emailForVerify) {
        try {
          setTransactionStatus('Awaiting wallet approval for on-chain verification...')
          const emailHash = await hashToField(emailForVerify)
          const onChainResult = await executeTransaction({
            program: PROGRAM_ID,
            function: 'verify_email_commitment',
            inputs: [emailHash],
            fee: FEE_EMAIL_VERIFY,
            privateFee: false,
          })
          const txId = String(onChainResult?.transactionId || onChainResult)
          const confirmation = await trackTransaction(txId, setTransactionStatus, 180_000, 6_000, walletTxStatus)
          if (confirmation.status === 'rejected') {
            console.warn('[zkEmail] On-chain verify rejected (backend verification still valid):', confirmation.rejectionReason)
          }
        } catch (err: any) {
          console.warn('[zkEmail] On-chain verify failed (backend verification still valid):', err?.message || err)
        }
      }

      setStatus({ registered: true, verified: true, status: 2 })
      setStep('done')
      setTestCode(null)
      setIsProcessing(false)
      setTransactionStatus(null)
      // Cache so VerifyIdGate skips the API call on next page load
      try {
        localStorage.setItem(`zk_verified_${address}`, 'true')
        window.dispatchEvent(new Event('zkcircles:verified'))
      } catch { /* ignore */ }
      return { success: true }
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Verification failed'
      console.error('[zkEmail] Verify error:', error)
      setIsProcessing(false)
      setTransactionStatus(null)
      setStep('sending_code')
      return { success: false, error: msg }
    }
  }, [connected, address, executeTransaction, emailForVerify, walletTxStatus])

  const resendCode = useCallback(async () => {
    if (!address) return
    setIsProcessing(true)
    const result = await sendEmailVerificationCode(address)
    if (result.testCode) setTestCode(result.testCode)
    setIsProcessing(false)
    return result
  }, [address])

  const refreshStatus = useCallback(async () => {
    if (!address) return
    const s = await checkEmailStatus(address)
    setStatus(s)
    if (s.verified) setStep('done')
  }, [address])

  return {
    registerEmail,
    submitVerificationCode,
    resendCode,
    refreshStatus,
    isProcessing,
    transactionStatus,
    status,
    step,
    testCode,
  }
}
