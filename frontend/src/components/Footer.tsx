import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Heart, Github, Twitter, ExternalLink } from 'lucide-react'

export default function Footer() {
  const currentYear = new Date().getFullYear()

  const footerLinks = {
    product: [
      { label: 'Create Circle', path: '/create' },
      { label: 'Join Circle', path: '/join' },
      { label: 'Explorer', path: '/explorer' },
      { label: 'My Circles', path: '/my-circles' },
    ],
    learn: [
      { label: 'How It Works', path: '/how-it-works' },
      { label: 'Privacy', path: '/privacy' },
      { label: 'Aleo Docs', path: 'https://developer.aleo.org/', external: true },
      { label: 'Leo Language', path: 'https://docs.leo-lang.org/', external: true },
    ],
    community: [
      { label: 'GitHub', path: 'https://github.com', external: true },
      { label: 'Twitter', path: 'https://twitter.com', external: true },
      { label: 'Discord', path: 'https://discord.com', external: true },
    ],
  }

  return (
    <footer className="bg-midnight-950 text-cream-100 mt-auto">
      {/* Wave decoration */}
      <div className="relative">
        <svg
          viewBox="0 0 1440 100"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-full h-12 md:h-16 -mb-1"
          preserveAspectRatio="none"
        >
          <path
            d="M0 100V60C240 20 480 0 720 20C960 40 1200 80 1440 60V100H0Z"
            fill="#1A1613"
          />
        </svg>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-16">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-12">
          {/* Brand column */}
          <div className="col-span-2 md:col-span-1">
            <Link to="/" className="flex items-center gap-3 mb-4">
              <div className="relative w-10 h-10">
                <motion.div
                  className="absolute inset-0 rounded-full border-2 border-amber-400/50"
                  animate={{ rotate: 360 }}
                  transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
                />
                <div className="absolute inset-1.5 rounded-full bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center">
                  <span className="text-white font-display font-bold text-sm">Z</span>
                </div>
              </div>
              <span className="font-display text-xl font-semibold">
                Zk<span className="text-amber-400">Circles</span>
              </span>
            </Link>
            <p className="text-cream-300 text-sm mb-6">
              Trustless, zero-knowledge rotating savings circles powered by Aleo. 
              Community finance for the modern age.
            </p>
            <div className="flex items-center gap-4">
              <a
                href="https://github.com"
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 rounded-lg bg-midnight-800 hover:bg-midnight-700 transition-colors"
              >
                <Github className="w-5 h-5" />
              </a>
              <a
                href="https://twitter.com"
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 rounded-lg bg-midnight-800 hover:bg-midnight-700 transition-colors"
              >
                <Twitter className="w-5 h-5" />
              </a>
            </div>
          </div>

          {/* Product links */}
          <div>
            <h3 className="font-semibold text-cream-50 mb-4">Product</h3>
            <ul className="space-y-3">
              {footerLinks.product.map((link) => (
                <li key={link.path}>
                  <Link
                    to={link.path}
                    className="text-cream-400 hover:text-amber-400 transition-colors text-sm"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Learn links */}
          <div>
            <h3 className="font-semibold text-cream-50 mb-4">Learn</h3>
            <ul className="space-y-3">
              {footerLinks.learn.map((link) => (
                <li key={link.path}>
                  {link.external ? (
                    <a
                      href={link.path}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-cream-400 hover:text-amber-400 transition-colors text-sm inline-flex items-center gap-1"
                    >
                      {link.label}
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  ) : (
                    <Link
                      to={link.path}
                      className="text-cream-400 hover:text-amber-400 transition-colors text-sm"
                    >
                      {link.label}
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </div>

          {/* Community links */}
          <div>
            <h3 className="font-semibold text-cream-50 mb-4">Community</h3>
            <ul className="space-y-3">
              {footerLinks.community.map((link) => (
                <li key={link.path}>
                  <a
                    href={link.path}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-cream-400 hover:text-amber-400 transition-colors text-sm inline-flex items-center gap-1"
                  >
                    {link.label}
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mt-12 pt-8 border-t border-midnight-800">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-cream-400 text-sm">
              © {currentYear} ZkCircles. All rights reserved.
            </p>
            <p className="text-cream-500 text-sm flex items-center gap-1">
              Built with <Heart className="w-4 h-4 text-terra-500 fill-terra-500" /> on Aleo
            </p>
          </div>
        </div>
      </div>

      {/* Decorative circles at the bottom */}
      <div className="relative h-2 overflow-hidden">
        <div className="absolute -bottom-20 left-1/4 w-40 h-40 rounded-full bg-amber-500/10 blur-3xl" />
        <div className="absolute -bottom-20 right-1/4 w-40 h-40 rounded-full bg-forest-500/10 blur-3xl" />
      </div>
    </footer>
  )
}
