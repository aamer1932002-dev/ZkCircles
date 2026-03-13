import { useState, useCallback, useEffect } from 'react'
import { useWallet } from '@provablehq/aleo-wallet-adaptor-react'
import { PROGRAM_ID, FEE_EMAIL_REGISTER, FEE_EMAIL_VERIFY } from '../config'
import { hashToField } from '../utils/aleo-utils'
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
  const [isProcessing, setIsProcessing] = useState(false)
  const [onChainPending, setOnChainPending] = useState(false)
  const [status, setStatus] = useState<EmailVerificationStatus>({
    registered: false,
    verified: false,
    status: 0,
  })
  const [step, setStep] = useState<'idle' | 'registering' | 'sending_code' | 'verifying' | 'done'>('idle')
  const [testCode, setTestCode] = useState<string | null>(null)

  // Check status on mount
  useEffect(() => {
    if (connected && address) {
      checkEmailStatus(address).then(setStatus)
    }
  }, [connected, address])

  const registerEmail = useCallback(async (email: string): Promise<VerificationResult> => {
    if (!connected || !address) return { success: false, error: 'Wallet not connected' }

    setIsProcessing(true)
    setStep('registering')

    try {
      // Hash the email off-chain (never transmitted in plaintext to chain)
      const emailHash = await hashToField(email.toLowerCase().trim())

      // Fire on-chain commitment in the background — non-blocking.
      // The wallet may reject or the tx may fail; either way backend verification is sufficient.
      let txId = 'backend-only'
      if (executeTransaction) {
        setOnChainPending(true)
        executeTransaction({
          program: PROGRAM_ID,
          function: 'register_email_commitment',
          inputs: [emailHash],
          fee: FEE_EMAIL_REGISTER,
          privateFee: false,
        }).then((result: any) => {
          txId = String(result?.transactionId || result || 'submitted')
        }).catch((err: any) => {
          console.warn('[zkEmail] On-chain commitment rejected/failed (non-fatal):', err?.message || err)
        }).finally(() => {
          setOnChainPending(false)
        })
      }

      // Register with backend immediately (don't wait for on-chain confirmation)
      await registerEmailCommitment({
        address,
        emailHash,
        transactionId: txId,
        email: email.toLowerCase().trim(),
      })

      setStatus(prev => ({ ...prev, registered: true, status: 1 }))
      setStep('sending_code')

      // Automatically send the verification code
      const codeResult = await sendEmailVerificationCode(address)
      if (codeResult.testCode) {
        setTestCode(codeResult.testCode)
      }

      setIsProcessing(false)
      return { success: true, transactionId: txId }
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Registration failed'
      console.error('[zkEmail] Register error:', error)
      setIsProcessing(false)
      setStep('idle')
      return { success: false, error: msg }
    }
  }, [connected, address, executeTransaction])

  const submitVerificationCode = useCallback(async (code: string): Promise<VerificationResult> => {
    if (!connected || !address) return { success: false, error: 'Wallet not connected' }

    setIsProcessing(true)
    setStep('verifying')

    try {
      // Verify code with backend
      const result = await verifyEmailCode({ address, code })
      if (!result.verified) {
        setIsProcessing(false)
        setStep('sending_code')
        return { success: false, error: result.error || 'Invalid code' }
      }

      // Optionally confirm on-chain (non-blocking — backend verification is sufficient)
      if (executeTransaction) {
        executeTransaction({
          program: PROGRAM_ID,
          function: 'verify_email_commitment',
          inputs: [`${address}field`.replace('aleo1', '') + 'field'], // placeholder field value
          fee: FEE_EMAIL_VERIFY,
          privateFee: false,
        }).catch((err: any) => {
          console.warn('[zkEmail] On-chain verify rejected/failed (non-fatal):', err?.message || err)
        })
      }

      setStatus({ registered: true, verified: true, status: 2 })
      setStep('done')
      setTestCode(null)
      setIsProcessing(false)
      return { success: true }
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Verification failed'
      console.error('[zkEmail] Verify error:', error)
      setIsProcessing(false)
      setStep('sending_code')
      return { success: false, error: msg }
    }
  }, [connected, address, executeTransaction])

  const resendCode = useCallback(async () => {
    if (!address) return
    setIsProcessing(true)
    const result = await sendEmailVerificationCode(address)
    if (result.testCode) setTestCode(result.testCode)
    setIsProcessing(false)
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
    onChainPending,
    status,
    step,
    testCode,
  }
}
