import { useState, useRef, useEffect } from 'react'
import { useWallet } from '@provablehq/aleo-wallet-adaptor-react'
import { Network } from '@provablehq/aleo-types'
import { motion, AnimatePresence } from 'framer-motion'
import { Wallet, ChevronDown, LogOut, Copy, Check, X, Loader2 } from 'lucide-react'

export default function WalletButton() {
  const { 
    wallets, 
    address, 
    connected, 
    connecting, 
    connect, 
    disconnect,
    selectWallet 
  } = useWallet()
  
  const [showDropdown, setShowDropdown] = useState(false)
  const [showWalletSelect, setShowWalletSelect] = useState(false)
  const [copied, setCopied] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false)
        setShowWalletSelect(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const truncateAddress = (addr: string) => {
    if (!addr) return ''
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`
  }

  const copyAddress = async () => {
    if (address) {
      await navigator.clipboard.writeText(address)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const handleWalletSelect = async (walletName: string) => {
    try {
      selectWallet(walletName as any)
      // Wait a moment for selection to register
      await new Promise(resolve => setTimeout(resolve, 100))
      await connect(Network.TESTNET)
      setShowWalletSelect(false)
    } catch (error) {
      console.error('Failed to connect:', error)
    }
  }

  const handleDisconnect = async () => {
    try {
      await disconnect()
      setShowDropdown(false)
    } catch (error) {
      console.error('Failed to disconnect:', error)
    }
  }

  // Connected state
  if (connected && address) {
    return (
      <div className="relative" ref={dropdownRef}>
        <button
          onClick={() => setShowDropdown(!showDropdown)}
          className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-600 text-white rounded-lg font-medium shadow-md hover:shadow-lg transition-all duration-200"
        >
          <Wallet className="w-4 h-4" />
          <span>{truncateAddress(address)}</span>
          <ChevronDown className={`w-4 h-4 transition-transform ${showDropdown ? 'rotate-180' : ''}`} />
        </button>
        
        <AnimatePresence>
          {showDropdown && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="absolute right-0 mt-2 w-64 bg-white rounded-xl shadow-xl border border-gray-100 overflow-hidden z-50"
            >
              <div className="p-4 border-b border-gray-100">
                <p className="text-sm text-gray-500 mb-1">Connected Wallet</p>
                <div className="flex items-center justify-between">
                  <p className="font-mono text-sm text-gray-800">{truncateAddress(address)}</p>
                  <button
                    onClick={copyAddress}
                    className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    {copied ? (
                      <Check className="w-4 h-4 text-green-500" />
                    ) : (
                      <Copy className="w-4 h-4 text-gray-500" />
                    )}
                  </button>
                </div>
              </div>
              <button
                onClick={handleDisconnect}
                className="w-full flex items-center gap-2 px-4 py-3 text-red-600 hover:bg-red-50 transition-colors"
              >
                <LogOut className="w-4 h-4" />
                <span>Disconnect</span>
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    )
  }

  // Connecting state
  if (connecting) {
    return (
      <button
        disabled
        className="flex items-center gap-2 px-4 py-2 bg-amber-100 text-amber-700 rounded-lg font-medium"
      >
        <Loader2 className="w-4 h-4 animate-spin" />
        <span>Connecting...</span>
      </button>
    )
  }

  // Disconnected state - show wallet selection
  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setShowWalletSelect(!showWalletSelect)}
        className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-600 text-white rounded-lg font-medium shadow-md hover:shadow-lg transition-all duration-200"
      >
        <Wallet className="w-4 h-4" />
        <span>Select Wallet</span>
      </button>

      <AnimatePresence>
        {showWalletSelect && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute right-0 mt-2 w-72 bg-white rounded-xl shadow-xl border border-gray-100 overflow-hidden z-50"
          >
            <div className="p-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="font-semibold text-gray-800">Connect Wallet</h3>
              <button
                onClick={() => setShowWalletSelect(false)}
                className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>
            <div className="p-2">
              {wallets.length === 0 ? (
                <p className="text-sm text-gray-500 p-3 text-center">
                  No wallets detected. Please install Shield Wallet or Leo Wallet.
                </p>
              ) : (
                wallets.map((w) => (
                  <button
                    key={w.adapter.name}
                    onClick={() => handleWalletSelect(w.adapter.name)}
                    className="w-full flex items-center gap-3 p-3 hover:bg-amber-50 rounded-lg transition-colors"
                  >
                    {w.adapter.icon ? (
                      <img src={w.adapter.icon} alt={w.adapter.name} className="w-8 h-8 rounded-lg" />
                    ) : (
                      <div className="w-8 h-8 bg-gradient-to-br from-amber-400 to-amber-600 rounded-lg flex items-center justify-center">
                        <Wallet className="w-4 h-4 text-white" />
                      </div>
                    )}
                    <div className="text-left">
                      <p className="font-medium text-gray-800">{w.adapter.name}</p>
                      <p className="text-xs text-gray-500">
                        {w.readyState === 'Installed' ? 'Ready' : 'Not installed'}
                      </p>
                    </div>
                  </button>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
