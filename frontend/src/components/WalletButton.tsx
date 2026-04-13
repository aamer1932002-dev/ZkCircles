import { useState, useRef, useEffect } from 'react'
import { useWallet } from '@provablehq/aleo-wallet-adaptor-react'
import { Network } from '@provablehq/aleo-types'
import { motion, AnimatePresence } from 'framer-motion'
import { Wallet, ChevronDown, LogOut, Copy, Check, X, Loader2 } from 'lucide-react'
import { STALE_PERMISSIONS_EVENT } from '../utils/walletErrors'

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
  const [stalePermissions, setStalePermissions] = useState(false)
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

  // Auto-open reconnect panel when a stale-permissions error is detected in any hook
  useEffect(() => {
    const handler = () => {
      // Clear stored wallet name so next connect() forces a fresh permission prompt
      localStorage.removeItem('walletName')
      setShowDropdown(false)
      setStalePermissions(true)
      setShowWalletSelect(true)
    }
    window.addEventListener(STALE_PERMISSIONS_EVENT, handler)
    return () => window.removeEventListener(STALE_PERMISSIONS_EVENT, handler)
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
    // Refuse to attempt connecting to wallets that aren't installed
    const wallet = wallets.find(w => w.adapter.name === walletName)
    if (!wallet) return
    if (wallet.readyState !== 'Installed') {
      const installUrl = (wallet.adapter as any).url as string | undefined
      if (installUrl) window.open(installUrl, '_blank', 'noopener')
      return
    }

    try {
      selectWallet(walletName as any)
      // Give the adapter state a full tick to settle before connecting
      await new Promise(resolve => setTimeout(resolve, 300))
      await connect(Network.TESTNET)
      setShowWalletSelect(false)
      setStalePermissions(false)
    } catch (error: any) {
      // Surface meaningful feedback instead of a raw console trace
      const msg: string = error?.message ?? ''
      if (msg.includes('No response')) {
        console.warn('Wallet extension did not respond — is it unlocked?')
      } else if (msg.includes('User rejected') || msg.includes('cancelled')) {
        console.info('Connection cancelled by user')
      } else {
        console.error('Failed to connect:', msg)
      }
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
                onClick={() => { setShowWalletSelect(false); setStalePermissions(false) }}
                className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>
            {stalePermissions && (
              <div className="mx-3 mt-3 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
                <strong>Reconnect required</strong> — your wallet session was for an older contract version. Please select your wallet again to grant access to <code>zk_circles_v15.aleo</code>.
              </div>
            )}
            <div className="p-2">
              {wallets.length === 0 ? (
                <p className="text-sm text-gray-500 p-3 text-center">
                  No wallets detected. Please install Shield Wallet or Leo Wallet.
                </p>
              ) : (
                wallets.map((w) => {
                  const installed = w.readyState === 'Installed'
                  return (
                    <button
                      key={w.adapter.name}
                      onClick={() => handleWalletSelect(w.adapter.name)}
                      className={`w-full flex items-center gap-3 p-3 rounded-lg transition-colors ${
                        installed
                          ? 'hover:bg-amber-50 cursor-pointer'
                          : 'opacity-50 cursor-default'
                      }`}
                    >
                      {w.adapter.icon ? (
                        <img src={w.adapter.icon} alt={w.adapter.name} className="w-8 h-8 rounded-lg" />
                      ) : (
                        <div className="w-8 h-8 bg-gradient-to-br from-amber-400 to-amber-600 rounded-lg flex items-center justify-center">
                          <Wallet className="w-4 h-4 text-white" />
                        </div>
                      )}
                      <div className="text-left flex-1">
                        <p className="font-medium text-gray-800">{w.adapter.name}</p>
                        <p className={`text-xs ${installed ? 'text-green-600' : 'text-gray-400'}`}>
                          {installed ? 'Ready to connect' : 'Not installed — click to install'}
                        </p>
                      </div>
                      {installed && (
                        <div className="w-2 h-2 rounded-full bg-green-400 flex-shrink-0" />
                      )}
                    </button>
                  )
                })
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
