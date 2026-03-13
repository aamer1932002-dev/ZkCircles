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
    if (!executeTransaction) return { success: false, error: 'Wallet does not support transactions' }

    setIsProcessing(true)
    setStep('registering')

    try {
      // Hash the email off-chain (never transmitted in plaintext to chain)
      const emailHash = await hashToField(email.toLowerCase().trim())

      // Submit on-chain commitment
      const result = await executeTransaction({
        program: PROGRAM_ID,
        function: 'register_email_commitment',
        inputs: [emailHash],
        fee: FEE_EMAIL_REGISTER,
        privateFee: false,
      })

      const txId = String((result as any)?.transactionId || result)

      // Register with backend
      await registerEmailCommitment({
        address,
        emailHash,
        transactionId: txId,
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

      // Optionally confirm on-chain (if wallet supports it)
      let txId: string | undefined
      if (executeTransaction) {
        try {
          const emailHash = await hashToField(address) // simplified — uses address as proxy
          const onChainResult = await executeTransaction({
            program: PROGRAM_ID,
            function: 'verify_email_commitment',
            inputs: [emailHash],
            fee: FEE_EMAIL_VERIFY,
            privateFee: false,
          })
          txId = String((onChainResult as any)?.transactionId || onChainResult)
        } catch {
          // On-chain verification is optional; backend verification is sufficient
        }
      }

      setStatus({ registered: true, verified: true, status: 2 })
      setStep('done')
      setTestCode(null)
      setIsProcessing(false)
      return { success: true, transactionId: txId }
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
    status,
    step,
    testCode,
  }
}
