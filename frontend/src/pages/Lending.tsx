import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { useWallet } from '@provablehq/aleo-wallet-adaptor-react'
import {
  Banknote,
  Send,
  ArrowDownLeft,
  XCircle,
  AlertTriangle,
  Loader2,
  Shield,
  TrendingUp,
  Info,
  CheckCircle2,
} from 'lucide-react'
import { useLending } from '../hooks/useLending'
import { useCreditScore } from '../hooks/useCreditScore'
import { MIN_BORROW_SCORE, MAX_INTEREST_BPS } from '../config'
import PageTransition from '../components/PageTransition'

type Tab = 'offer' | 'borrow' | 'manage'

function ScoreBadge({ score, grade }: { score: number; grade: string }) {
  const color =
    score >= 85 ? 'text-green-700 bg-green-100 border-green-200' :
    score >= 55 ? 'text-amber-700 bg-amber-100 border-amber-200' :
    score >= 40 ? 'text-orange-700 bg-orange-100 border-orange-200' :
    'text-red-700 bg-red-100 border-red-200'

  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-semibold border ${color}`}>
      <Shield className="w-3.5 h-3.5" />
      {grade} · {score}
    </span>
  )
}

export default function Lending() {
  const { connected, address } = useWallet() as any
  const {
    offerLoan,
    acceptLoan,
    repayLoan,
    cancelLoan,
    defaultLoan,
    isProcessing,
    transactionStatus,
  } = useLending()
  const { creditScore, onChainScore, isLoading: scoreLoading, fetchScore, publishScore, isPublishing } = useCreditScore()

  const [tab, setTab] = useState<Tab>('offer')

  // Offer form state
  const [borrower, setBorrower] = useState('')
  const [amount, setAmount] = useState('')
  const [interestBps, setInterestBps] = useState('500') // 5%

  // Accept form state
  const [acceptLoanId, setAcceptLoanId] = useState('')
  const [acceptAmount, setAcceptAmount] = useState('')

  // Repay form state
  const [repayLoanId, setRepayLoanId] = useState('')
  const [repayAmount, setRepayAmount] = useState('')
  const [repayLender, setRepayLender] = useState('')

  // Cancel form state
  const [cancelLoanId, setCancelLoanId] = useState('')
  const [cancelAmount, setCancelAmount] = useState('')

  // Default form state
  const [defaultLoanId, setDefaultLoanId] = useState('')
  const [defaultBorrower, setDefaultBorrower] = useState('')

  const [result, setResult] = useState<{ success: boolean; message: string; loanId?: string } | null>(null)

  useEffect(() => {
    if (connected && address) fetchScore()
  }, [connected, address, fetchScore])

  const clearResult = () => setResult(null)

  const handleOffer = useCallback(async () => {
    clearResult()
    const amountMicro = Math.floor(parseFloat(amount) * 1_000_000)
    if (!borrower || isNaN(amountMicro) || amountMicro <= 0) {
      setResult({ success: false, message: 'Enter a valid borrower address and amount.' })
      return
    }
    const bps = parseInt(interestBps) || 0
    if (bps > MAX_INTEREST_BPS) {
      setResult({ success: false, message: `Interest cannot exceed ${MAX_INTEREST_BPS / 100}%.` })
      return
    }
    const res = await offerLoan({ borrower, amount: amountMicro, interestBps: bps })
    if (res.success) {
      setResult({ success: true, message: 'Loan offered successfully!', loanId: res.loanId })
      setBorrower('')
      setAmount('')
    } else {
      setResult({ success: false, message: res.error || 'Offer failed.' })
    }
  }, [borrower, amount, interestBps, offerLoan])

  const handleAccept = useCallback(async () => {
    clearResult()
    const amountMicro = Math.floor(parseFloat(acceptAmount) * 1_000_000)
    if (!acceptLoanId || isNaN(amountMicro) || amountMicro <= 0) {
      setResult({ success: false, message: 'Enter a valid loan ID and amount.' })
      return
    }
    const res = await acceptLoan(acceptLoanId, amountMicro)
    if (res.success) {
      setResult({ success: true, message: 'Loan accepted! Funds transferred to your account.' })
      setAcceptLoanId('')
      setAcceptAmount('')
    } else {
      setResult({ success: false, message: res.error || 'Accept failed.' })
    }
  }, [acceptLoanId, acceptAmount, acceptLoan])

  const handleRepay = useCallback(async () => {
    clearResult()
    const amountMicro = Math.floor(parseFloat(repayAmount) * 1_000_000)
    if (!repayLoanId || !repayLender || isNaN(amountMicro) || amountMicro <= 0) {
      setResult({ success: false, message: 'Fill in all repayment fields.' })
      return
    }
    const res = await repayLoan(repayLoanId, amountMicro, repayLender)
    if (res.success) {
      setResult({ success: true, message: 'Loan repaid! Your credit score will improve.' })
      setRepayLoanId('')
      setRepayAmount('')
      setRepayLender('')
    } else {
      setResult({ success: false, message: res.error || 'Repay failed.' })
    }
  }, [repayLoanId, repayAmount, repayLender, repayLoan])

  const handleCancel = useCallback(async () => {
    clearResult()
    const amountMicro = Math.floor(parseFloat(cancelAmount) * 1_000_000)
    if (!cancelLoanId || isNaN(amountMicro) || amountMicro <= 0) {
      setResult({ success: false, message: 'Enter loan ID and principal amount.' })
      return
    }
    const res = await cancelLoan(cancelLoanId, amountMicro)
    if (res.success) {
      setResult({ success: true, message: 'Loan cancelled. Funds returned.' })
      setCancelLoanId('')
      setCancelAmount('')
    } else {
      setResult({ success: false, message: res.error || 'Cancel failed.' })
    }
  }, [cancelLoanId, cancelAmount, cancelLoan])

  const handleDefault = useCallback(async () => {
    clearResult()
    if (!defaultLoanId || !defaultBorrower) {
      setResult({ success: false, message: 'Enter loan ID and borrower address.' })
      return
    }
    const res = await defaultLoan(defaultLoanId, defaultBorrower)
    if (res.success) {
      setResult({ success: true, message: 'Loan marked as defaulted. Borrower score damaged.' })
      setDefaultLoanId('')
      setDefaultBorrower('')
    } else {
      setResult({ success: false, message: res.error || 'Default marking failed.' })
    }
  }, [defaultLoanId, defaultBorrower, defaultLoan])

  const displayScore = onChainScore ?? creditScore.score

  const tabs = [
    { key: 'offer' as Tab, label: 'Offer Loan', icon: Send },
    { key: 'borrow' as Tab, label: 'Borrow', icon: ArrowDownLeft },
    { key: 'manage' as Tab, label: 'Manage', icon: Banknote },
  ]

  return (
    <PageTransition>
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-8">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-3xl md:text-4xl font-display font-bold text-midnight-900">
            Peer-to-Peer <span className="text-amber-600">Lending</span>
          </h1>
          <p className="mt-2 text-midnight-600 max-w-2xl mx-auto">
            Lend and borrow ALEO credits backed by your on-chain credit score.
            No intermediaries — trust is earned through circle participation.
          </p>
        </div>

        {/* Credit Score Banner */}
        {connected && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-2xl border border-cream-200 p-6"
          >
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center">
                  <TrendingUp className="w-7 h-7 text-amber-600" />
                </div>
                <div>
                  <p className="text-sm text-midnight-500">Your Credit Score</p>
                  <div className="flex items-center gap-3 mt-1">
                    {scoreLoading ? (
                      <Loader2 className="w-5 h-5 animate-spin text-midnight-400" />
                    ) : (
                      <>
                        <span className="text-3xl font-bold text-midnight-900">{displayScore}</span>
                        <ScoreBadge score={displayScore} grade={creditScore.grade} />
                      </>
                    )}
                  </div>
                  {displayScore < MIN_BORROW_SCORE && (
                    <p className="text-xs text-red-600 mt-1 flex items-center gap-1">
                      <Info className="w-3 h-3" />
                      Score must be ≥ {MIN_BORROW_SCORE} to borrow
                    </p>
                  )}
                </div>
              </div>

              <button
                onClick={publishScore}
                disabled={isPublishing || scoreLoading}
                className="btn-secondary text-sm py-2 px-4 flex items-center gap-2"
              >
                {isPublishing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Shield className="w-4 h-4" />}
                Publish On-Chain
              </button>
            </div>
          </motion.div>
        )}

        {/* Not connected */}
        {!connected && (
          <div className="bg-cream-50 border border-cream-200 rounded-2xl p-8 text-center">
            <Shield className="w-12 h-12 text-amber-500 mx-auto mb-3" />
            <p className="text-midnight-700 font-medium">Connect your wallet to access lending.</p>
            <p className="text-sm text-midnight-500 mt-1">You need a credit score of {MIN_BORROW_SCORE}+ to borrow.</p>
          </div>
        )}

        {connected && (
          <>
            {/* Tabs */}
            <div className="flex gap-1 bg-cream-100 p-1 rounded-xl">
              {tabs.map(({ key, label, icon: Icon }) => (
                <button
                  key={key}
                  onClick={() => { setTab(key); clearResult() }}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-sm font-medium transition-all ${
                    tab === key
                      ? 'bg-white text-amber-700 shadow-sm'
                      : 'text-midnight-500 hover:text-midnight-700'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {label}
                </button>
              ))}
            </div>

            {/* Result banner */}
            {result && (
              <motion.div
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex items-center gap-3 rounded-xl p-4 text-sm ${
                  result.success
                    ? 'bg-green-50 border border-green-200 text-green-800'
                    : 'bg-red-50 border border-red-200 text-red-800'
                }`}
              >
                {result.success ? <CheckCircle2 className="w-5 h-5 flex-shrink-0" /> : <AlertTriangle className="w-5 h-5 flex-shrink-0" />}
                <div className="flex-1">
                  <span>{result.message}</span>
                  {result.loanId && (
                    <div className="mt-2 flex items-center gap-2">
                      <span className="text-xs font-medium opacity-70">Loan ID:</span>
                      <code className="text-xs bg-white/60 px-2 py-1 rounded-md font-mono break-all select-all">{result.loanId}</code>
                      <button
                        onClick={() => { navigator.clipboard.writeText(result.loanId!); }}
                        className="text-xs underline hover:opacity-70"
                      >Copy</button>
                    </div>
                  )}
                </div>
                <button onClick={clearResult} className="hover:opacity-70">
                  <XCircle className="w-4 h-4" />
                </button>
              </motion.div>
            )}

            {/* Transaction status */}
            {transactionStatus && (
              <div className="flex items-center gap-2 rounded-xl bg-amber-50 border border-amber-200 p-4 text-sm text-amber-800">
                <Loader2 className="w-4 h-4 animate-spin flex-shrink-0" />
                {transactionStatus}
              </div>
            )}

            {/* Form panels */}
            <motion.div
              key={tab}
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.2 }}
              className="bg-white rounded-2xl border border-cream-200 p-6 space-y-5"
            >
              {/* ─── Offer Tab ─── */}
              {tab === 'offer' && (
                <>
                  <div>
                    <h3 className="text-lg font-semibold text-midnight-900 flex items-center gap-2">
                      <Send className="w-5 h-5 text-amber-600" />
                      Offer a Loan
                    </h3>
                    <p className="text-sm text-midnight-500 mt-1">
                      Deposit ALEO credits for a specific borrower. They must accept and meet the minimum score.
                    </p>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-midnight-700 mb-1">Borrower Address</label>
                      <input
                        type="text"
                        value={borrower}
                        onChange={e => setBorrower(e.target.value)}
                        placeholder="aleo1..."
                        className="input w-full"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-midnight-700 mb-1">Amount (ALEO)</label>
                        <input
                          type="number"
                          value={amount}
                          onChange={e => setAmount(e.target.value)}
                          placeholder="10"
                          min="0.000001"
                          step="0.1"
                          className="input w-full"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-midnight-700 mb-1">
                          Interest ({(parseInt(interestBps) / 100 || 0).toFixed(1)}%)
                        </label>
                        <input
                          type="range"
                          min="0"
                          max={MAX_INTEREST_BPS}
                          step="100"
                          value={interestBps}
                          onChange={e => setInterestBps(e.target.value)}
                          className="w-full accent-amber-600"
                        />
                        <div className="flex justify-between text-xs text-midnight-400 mt-1">
                          <span>0%</span>
                          <span>{MAX_INTEREST_BPS / 100}%</span>
                        </div>
                      </div>
                    </div>
                    {amount && (
                      <div className="bg-cream-50 rounded-xl p-3 text-sm text-midnight-600">
                        Repayment: <strong>
                          {(parseFloat(amount) * (1 + parseInt(interestBps) / 10000)).toFixed(6)} ALEO
                        </strong>
                        <span className="text-midnight-400 ml-1">
                          ({(parseInt(interestBps) / 100).toFixed(1)}% interest)
                        </span>
                      </div>
                    )}
                  </div>

                  <button
                    onClick={handleOffer}
                    disabled={isProcessing || !borrower || !amount}
                    className="btn-primary w-full py-3 flex items-center justify-center gap-2"
                  >
                    {isProcessing ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                    Offer Loan
                  </button>
                </>
              )}

              {/* ─── Borrow Tab ─── */}
              {tab === 'borrow' && (
                <>
                  <div>
                    <h3 className="text-lg font-semibold text-midnight-900 flex items-center gap-2">
                      <ArrowDownLeft className="w-5 h-5 text-amber-600" />
                      Accept a Loan
                    </h3>
                    <p className="text-sm text-midnight-500 mt-1">
                      Accept a loan offered to you. Requires a credit score of {MIN_BORROW_SCORE}+.
                    </p>
                  </div>

                  {displayScore < MIN_BORROW_SCORE && (
                    <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700 flex items-start gap-2">
                      <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="font-medium">Score too low to borrow</p>
                        <p className="mt-1 text-red-600">
                          Your score is {displayScore}. You need at least {MIN_BORROW_SCORE}.
                          Contribute to circles to build your reputation.
                        </p>
                      </div>
                    </div>
                  )}

                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-midnight-700 mb-1">Loan ID</label>
                      <input
                        type="text"
                        value={acceptLoanId}
                        onChange={e => setAcceptLoanId(e.target.value)}
                        placeholder="Loan field ID from the lender"
                        className="input w-full"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-midnight-700 mb-1">Principal Amount (ALEO)</label>
                      <input
                        type="number"
                        value={acceptAmount}
                        onChange={e => setAcceptAmount(e.target.value)}
                        placeholder="10"
                        min="0.000001"
                        step="0.1"
                        className="input w-full"
                      />
                    </div>
                  </div>

                  <button
                    onClick={handleAccept}
                    disabled={isProcessing || !acceptLoanId || !acceptAmount || displayScore < MIN_BORROW_SCORE}
                    className="btn-primary w-full py-3 flex items-center justify-center gap-2"
                  >
                    {isProcessing ? <Loader2 className="w-5 h-5 animate-spin" /> : <ArrowDownLeft className="w-5 h-5" />}
                    Accept Loan
                  </button>
                </>
              )}

              {/* ─── Manage Tab ─── */}
              {tab === 'manage' && (
                <div className="space-y-8">
                  {/* Repay section */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-midnight-900 flex items-center gap-2">
                      <CheckCircle2 className="w-5 h-5 text-green-600" />
                      Repay Loan
                    </h3>
                    <div className="space-y-3">
                      <div>
                        <label className="block text-sm font-medium text-midnight-700 mb-1">Loan ID</label>
                        <input
                          type="text"
                          value={repayLoanId}
                          onChange={e => setRepayLoanId(e.target.value)}
                          placeholder="Loan field ID"
                          className="input w-full"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-midnight-700 mb-1">Repay Amount (ALEO)</label>
                          <input
                            type="number"
                            value={repayAmount}
                            onChange={e => setRepayAmount(e.target.value)}
                            placeholder="10.5"
                            min="0.000001"
                            step="0.1"
                            className="input w-full"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-midnight-700 mb-1">Lender Address</label>
                          <input
                            type="text"
                            value={repayLender}
                            onChange={e => setRepayLender(e.target.value)}
                            placeholder="aleo1..."
                            className="input w-full"
                          />
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={handleRepay}
                      disabled={isProcessing || !repayLoanId || !repayAmount || !repayLender}
                      className="btn-primary w-full py-2.5 flex items-center justify-center gap-2"
                    >
                      {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                      Repay
                    </button>
                  </div>

                  <hr className="border-cream-200" />

                  {/* Cancel section */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-midnight-900 flex items-center gap-2">
                      <XCircle className="w-5 h-5 text-midnight-400" />
                      Cancel Loan Offer
                    </h3>
                    <p className="text-xs text-midnight-500">Cancel an unaccepted loan offer and reclaim your funds.</p>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-midnight-700 mb-1">Loan ID</label>
                        <input
                          type="text"
                          value={cancelLoanId}
                          onChange={e => setCancelLoanId(e.target.value)}
                          placeholder="Loan field ID"
                          className="input w-full"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-midnight-700 mb-1">Principal (ALEO)</label>
                        <input
                          type="number"
                          value={cancelAmount}
                          onChange={e => setCancelAmount(e.target.value)}
                          placeholder="10"
                          className="input w-full"
                        />
                      </div>
                    </div>
                    <button
                      onClick={handleCancel}
                      disabled={isProcessing || !cancelLoanId || !cancelAmount}
                      className="btn-secondary w-full py-2.5 flex items-center justify-center gap-2"
                    >
                      {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
                      Cancel Offer
                    </button>
                  </div>

                  <hr className="border-cream-200" />

                  {/* Default section */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-midnight-900 flex items-center gap-2">
                      <AlertTriangle className="w-5 h-5 text-red-500" />
                      Mark Default
                    </h3>
                    <p className="text-xs text-midnight-500">
                      Flag a borrower who hasn't repaid. This permanently damages their credit score.
                    </p>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-midnight-700 mb-1">Loan ID</label>
                        <input
                          type="text"
                          value={defaultLoanId}
                          onChange={e => setDefaultLoanId(e.target.value)}
                          placeholder="Loan field ID"
                          className="input w-full"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-midnight-700 mb-1">Borrower Address</label>
                        <input
                          type="text"
                          value={defaultBorrower}
                          onChange={e => setDefaultBorrower(e.target.value)}
                          placeholder="aleo1..."
                          className="input w-full"
                        />
                      </div>
                    </div>
                    <button
                      onClick={handleDefault}
                      disabled={isProcessing || !defaultLoanId || !defaultBorrower}
                      className="bg-red-600 hover:bg-red-700 text-white w-full py-2.5 rounded-xl text-sm font-medium flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
                    >
                      {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <AlertTriangle className="w-4 h-4" />}
                      Mark as Defaulted
                    </button>
                  </div>
                </div>
              )}
            </motion.div>

            {/* Info section */}
            <div className="bg-cream-50 border border-cream-200 rounded-2xl p-6 space-y-3">
              <h4 className="font-semibold text-midnight-800 flex items-center gap-2">
                <Info className="w-4 h-4 text-amber-600" />
                How Lending Works
              </h4>
              <ul className="text-sm text-midnight-600 space-y-2">
                <li className="flex items-start gap-2">
                  <span className="text-amber-500 font-semibold mt-0.5">1.</span>
                  <span><strong>Offer:</strong> Deposit ALEO credits for a specific borrower. Funds are held by the contract.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-amber-500 font-semibold mt-0.5">2.</span>
                  <span><strong>Accept:</strong> Borrower accepts the loan (requires score ≥ {MIN_BORROW_SCORE}). Funds are released.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-amber-500 font-semibold mt-0.5">3.</span>
                  <span><strong>Repay:</strong> Borrower repays principal + interest. Their credit score improves.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-amber-500 font-semibold mt-0.5">4.</span>
                  <span><strong>Default:</strong> If unpaid, lender can mark default — permanently damages the borrower's score.</span>
                </li>
              </ul>
              <p className="text-xs text-midnight-400 mt-2">
                Repayment is trust-based. Aleo cannot force on-chain repayment, but defaults permanently damage your
                credit score, blocking future borrowing and access to reputation-gated circles.
              </p>
            </div>
          </>
        )}
      </div>
    </PageTransition>
  )
}
