import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useWallet } from '@provablehq/aleo-wallet-adaptor-react'
import { motion, AnimatePresence } from 'framer-motion'
import { Menu, X, Circle, Users, Compass, BookOpen, Shield } from 'lucide-react'
import WalletButton from './WalletButton'

const navLinks = [
  { path: '/', label: 'Home', icon: Circle },
  { path: '/my-circles', label: 'My Circles', icon: Users },
  { path: '/explorer', label: 'Explorer', icon: Compass },
  { path: '/how-it-works', label: 'How It Works', icon: BookOpen },
  { path: '/privacy', label: 'Privacy', icon: Shield },
]

export default function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const location = useLocation()
  const { connected } = useWallet()

  return (
    <header className="sticky top-0 z-50 bg-cream-50/90 backdrop-blur-md border-b border-cream-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 md:h-20">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-3 group">
            <div className="relative w-10 h-10 md:w-12 md:h-12">
              <img 
                src="/logo.svg" 
                alt="ZkCircles Logo" 
                className="w-full h-full object-contain"
              />
            </div>
            <div className="hidden sm:block">
              <span className="font-display text-xl md:text-2xl font-semibold text-midnight-900">
                Zk<span className="text-amber-600">Circles</span>
              </span>
              <p className="text-[10px] md:text-xs text-midnight-500 -mt-1">
                Community Savings on Aleo
              </p>
            </div>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden lg:flex items-center gap-1">
            {navLinks.map((link) => {
              const isActive = location.pathname === link.path
              const Icon = link.icon
              return (
                <Link
                  key={link.path}
                  to={link.path}
                  className={`
                    relative px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200
                    flex items-center gap-2
                    ${isActive 
                      ? 'text-amber-700 bg-amber-50' 
                      : 'text-midnight-600 hover:text-amber-600 hover:bg-cream-100'
                    }
                  `}
                >
                  <Icon className="w-4 h-4" />
                  {link.label}
                  {isActive && (
                    <motion.div
                      layoutId="nav-indicator"
                      className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1/2 h-0.5 bg-amber-500 rounded-full"
                    />
                  )}
                </Link>
              )
            })}
          </nav>

          {/* Right side - Wallet & Actions */}
          <div className="flex items-center gap-3">
            {connected && (
              <Link
                to="/create"
                className="hidden md:flex btn-primary text-sm py-2 px-4"
              >
                Create Circle
              </Link>
            )}
            
            <WalletButton />

            {/* Mobile menu button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-2 rounded-xl hover:bg-cream-100 transition-colors"
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? (
                <X className="w-6 h-6 text-midnight-700" />
              ) : (
                <Menu className="w-6 h-6 text-midnight-700" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Navigation */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="lg:hidden border-t border-cream-200 bg-cream-50"
          >
            <nav className="px-4 py-4 space-y-2">
              {navLinks.map((link) => {
                const isActive = location.pathname === link.path
                const Icon = link.icon
                return (
                  <Link
                    key={link.path}
                    to={link.path}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`
                      flex items-center gap-3 px-4 py-3 rounded-xl transition-all
                      ${isActive 
                        ? 'bg-amber-50 text-amber-700 font-medium' 
                        : 'text-midnight-600 hover:bg-cream-100'
                      }
                    `}
                  >
                    <Icon className="w-5 h-5" />
                    {link.label}
                  </Link>
                )
              })}
              {connected && (
                <Link
                  to="/create"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center justify-center gap-2 btn-primary w-full mt-4"
                >
                  Create Circle
                </Link>
              )}
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  )
}
