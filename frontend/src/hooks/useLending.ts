import { useState, useCallback } from 'react'
import { useWallet } from '@provablehq/aleo-wallet-adaptor-react'
import { generateSalt, hashToField } from '../utils/aleo-utils'
import { trackTransaction } from '../utils/transactionTracker'
import {
  PROGRAM_ID,
  FEE_OFFER_LOAN,
  FEE_ACCEPT_LOAN,
  FEE_REPAY_LOAN,
  FEE_CANCEL_LOAN,
  FEE_DEFAULT_LOAN,
} from '../config'
import {
  isStalePermissionsError,
  dispatchStalePermissionsEvent,
} from '../utils/walletErrors'

export interface LoanParams {
  borrower: string
  amount: number       // microcredits
  interestBps: number  // basis points (100 = 1%)
}

interface LoanResult {
  success: boolean
  loanId?: string
  transactionId?: string
  error?: string
}

export function useLending() {
  const wallet = useWallet() as any
  const { connected, address, executeTransaction, disconnect } = wallet
  const walletTxStatus: ((id: string) => Promise<{ status?: string; transactionId?: string }>) | undefined =
    wallet.transactionStatus
  const [isProcessing, setIsProcessing] = useState(false)
  const [transactionStatus, setTransactionStatus] = useState<string | null>(null)

  const offerLoan = useCallback(async (params: LoanParams): Promise<LoanResult> => {
    if (!connected || !address || !executeTransaction) {
      return { success: false, error: 'Wallet not connected' }
    }

    setIsProcessing(true)
    setTransactionStatus('Preparing loan offer...')

    try {
      const salt = generateSalt()
      const loanId = await hashToField(`${address}:loan:${params.borrower}:${salt}`)

      const inputs = [
        params.borrower,                   // borrower: address
        `${params.amount}u64`,            // amount: u64
        `${params.interestBps}u16`,       // interest_bps: u16
        loanId,                            // loan_id: field
      ]

      setTransactionStatus('Awaiting wallet approval...')

      const result = await executeTransaction({
        program: PROGRAM_ID,
        function: 'offer_loan',
        inputs,
        fee: FEE_OFFER_LOAN,
        privateFee: false,
      })

      const txId = String(result?.transactionId || result)
      const confirmation = await trackTransaction(txId, setTransactionStatus, 180_000, 6_000, walletTxStatus)

      if (confirmation.status === 'rejected') {
        setIsProcessing(false)
        setTransactionStatus(null)
        return { success: false, error: `Transaction rejected: ${confirmation.rejectionReason || 'Finalize failed.'}` }
      }

      setIsProcessing(false)
      setTransactionStatus(null)
      return { success: true, loanId, transactionId: txId }
    } catch (error) {
      return handleError(error)
    }
  }, [connected, address, executeTransaction, disconnect, walletTxStatus])

  const acceptLoan = useCallback(async (loanId: string, amount: number): Promise<LoanResult> => {
    if (!connected || !address || !executeTransaction) {
      return { success: false, error: 'Wallet not connected' }
    }

    setIsProcessing(true)
    setTransactionStatus('Accepting loan...')

    try {
      const result = await executeTransaction({
        program: PROGRAM_ID,
        function: 'accept_loan',
        inputs: [loanId, `${amount}u64`],
        fee: FEE_ACCEPT_LOAN,
        privateFee: false,
      })

      const txId = String(result?.transactionId || result)
      const confirmation = await trackTransaction(txId, setTransactionStatus, 180_000, 6_000, walletTxStatus)

      if (confirmation.status === 'rejected') {
        setIsProcessing(false)
        setTransactionStatus(null)
        return { success: false, error: `Rejected: ${confirmation.rejectionReason || 'Score too low or invalid loan.'}` }
      }

      setIsProcessing(false)
      setTransactionStatus(null)
      return { success: true, loanId, transactionId: txId }
    } catch (error) {
      return handleError(error)
    }
  }, [connected, address, executeTransaction, disconnect, walletTxStatus])

  const repayLoan = useCallback(async (loanId: string, repayAmount: number, lender: string): Promise<LoanResult> => {
    if (!connected || !address || !executeTransaction) {
      return { success: false, error: 'Wallet not connected' }
    }

    setIsProcessing(true)
    setTransactionStatus('Repaying loan...')

    try {
      const result = await executeTransaction({
        program: PROGRAM_ID,
        function: 'repay_loan',
        inputs: [loanId, `${repayAmount}u64`, lender],
        fee: FEE_REPAY_LOAN,
        privateFee: false,
      })

      const txId = String(result?.transactionId || result)
      const confirmation = await trackTransaction(txId, setTransactionStatus, 180_000, 6_000, walletTxStatus)

      if (confirmation.status === 'rejected') {
        setIsProcessing(false)
        setTransactionStatus(null)
        return { success: false, error: 'Repayment rejected on-chain.' }
      }

      setIsProcessing(false)
      setTransactionStatus(null)
      return { success: true, loanId, transactionId: txId }
    } catch (error) {
      return handleError(error)
    }
  }, [connected, address, executeTransaction, disconnect, walletTxStatus])

  const cancelLoan = useCallback(async (loanId: string, amount: number): Promise<LoanResult> => {
    if (!connected || !address || !executeTransaction) {
      return { success: false, error: 'Wallet not connected' }
    }

    setIsProcessing(true)
    setTransactionStatus('Cancelling loan...')

    try {
      const result = await executeTransaction({
        program: PROGRAM_ID,
        function: 'cancel_loan',
        inputs: [loanId, `${amount}u64`],
        fee: FEE_CANCEL_LOAN,
        privateFee: false,
      })

      const txId = String(result?.transactionId || result)
      const confirmation = await trackTransaction(txId, setTransactionStatus, 180_000, 6_000, walletTxStatus)

      if (confirmation.status === 'rejected') {
        setIsProcessing(false)
        setTransactionStatus(null)
        return { success: false, error: 'Cancel rejected on-chain.' }
      }

      setIsProcessing(false)
      setTransactionStatus(null)
      return { success: true, loanId, transactionId: txId }
    } catch (error) {
      return handleError(error)
    }
  }, [connected, address, executeTransaction, disconnect, walletTxStatus])

  const defaultLoan = useCallback(async (loanId: string, borrower: string): Promise<LoanResult> => {
    if (!connected || !address || !executeTransaction) {
      return { success: false, error: 'Wallet not connected' }
    }

    setIsProcessing(true)
    setTransactionStatus('Marking default...')

    try {
      const result = await executeTransaction({
        program: PROGRAM_ID,
        function: 'default_loan',
        inputs: [loanId, borrower],
        fee: FEE_DEFAULT_LOAN,
        privateFee: false,
      })

      const txId = String(result?.transactionId || result)
      const confirmation = await trackTransaction(txId, setTransactionStatus, 180_000, 6_000, walletTxStatus)

      if (confirmation.status === 'rejected') {
        setIsProcessing(false)
        setTransactionStatus(null)
        return { success: false, error: 'Default marking rejected.' }
      }

      setIsProcessing(false)
      setTransactionStatus(null)
      return { success: true, loanId, transactionId: txId }
    } catch (error) {
      return handleError(error)
    }
  }, [connected, address, executeTransaction, disconnect, walletTxStatus])

  const handleError = (error: unknown): LoanResult => {
    const msg = error instanceof Error ? error.message : 'Unknown error'
    if (isStalePermissionsError(msg)) {
      try { disconnect?.() } catch { /* ignore */ }
      dispatchStalePermissionsEvent()
    }
    setIsProcessing(false)
    setTransactionStatus(null)
    return { success: false, error: msg }
  }

  return {
    offerLoan,
    acceptLoan,
    repayLoan,
    cancelLoan,
    defaultLoan,
    isProcessing,
    transactionStatus,
  }
}
