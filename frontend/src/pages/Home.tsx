import { Link } from 'react-router-dom'
import { useWallet } from '@provablehq/aleo-wallet-adaptor-react'
import { motion } from 'framer-motion'
import { 
  Zap, 
  ArrowRight, 
  CircleDot,
  CheckCircle2,
  XCircle
} from 'lucide-react'
import ZkCirclesIllustration from '../components/ZkCirclesIllustration'

export default function Home() {
  const { connected } = useWallet()

  const howItWorks = [
    {
      step: 1,
      title: 'Create or Join',
      description: 'Start a new savings circle or join an existing one. Set contribution amounts and cycle duration.',
    },
    {
      step: 2,
      title: 'Contribute Privately',
      description: 'Each cycle, members contribute to the pool. ZK proofs verify contributions without revealing amounts.',
    },
    {
      step: 3,
      title: 'Receive Payouts',
      description: 'Members take turns receiving the pooled funds. Order is fair and transparent.',
    },
    {
      step: 4,
      title: 'Build Credit History',
      description: 'Use your participation history to prove creditworthiness for traditional finance.',
    },
  ]

  return (
    <div className="overflow-hidden">
      {/* Hero Section */}
      <section className="relative min-h-[90vh] flex items-center">
        {/* Background decorations */}
        <div className="absolute inset-0 bg-hero-gradient opacity-80" />
        <div className="absolute inset-0 bg-pattern-circles opacity-50" />
        
        {/* Floating circles decoration */}
        <motion.div
          className="absolute top-20 right-10 w-64 h-64 rounded-full border-2 border-amber-300/30"
          animate={{ rotate: 360 }}
          transition={{ duration: 30, repeat: Infinity, ease: 'linear' }}
        />
        <motion.div
          className="absolute bottom-20 left-10 w-48 h-48 rounded-full border-2 border-forest-300/30"
          animate={{ rotate: -360 }}
          transition={{ duration: 25, repeat: Infinity, ease: 'linear' }}
        />
        <motion.div
          className="absolute top-40 left-1/4 w-32 h-32 rounded-full bg-terra-200/20"
          animate={{ y: [0, -20, 0] }}
          transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
        />
        
        {/* Warm glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-warm-glow" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* Left content */}
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6 }}
            >
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-amber-100 rounded-full mb-6">
                <CircleDot className="w-4 h-4 text-amber-600" />
                <span className="text-sm font-medium text-amber-800">
                  Powered by Aleo Zero-Knowledge Proofs
                </span>
              </div>

              <h1 className="font-display text-4xl md:text-5xl lg:text-6xl font-bold text-midnight-900 leading-tight mb-6">
                Community Savings,{' '}
                <span className="text-gradient-warm">
                  Reimagined
                </span>
              </h1>

              <p className="text-lg md:text-xl text-midnight-600 mb-8 max-w-xl">
                ZkCircles brings traditional rotating savings (tandas, chamas, stokvels) 
                to the blockchain with complete privacy and trustless guarantees.
              </p>

              <div className="flex flex-col sm:flex-row gap-4 mb-12">
                {connected ? (
                  <>
                    <Link to="/create" className="btn-primary flex items-center justify-center gap-2">
                      Create a Circle
                      <ArrowRight className="w-5 h-5" />
                    </Link>
                    <Link to="/join" className="btn-secondary flex items-center justify-center gap-2">
                      Join a Circle
                    </Link>
                  </>
                ) : (
                  <>
                    <Link to="/how-it-works" className="btn-primary flex items-center justify-center gap-2">
                      Learn How It Works
                      <ArrowRight className="w-5 h-5" />
                    </Link>
                    <Link to="/explorer" className="btn-secondary flex items-center justify-center gap-2">
                      Explore Circles
                    </Link>
                  </>
                )}
              </div>

              {/* Trust badges — inspired by NullPay */}
              <div className="flex flex-wrap gap-2 mb-10">
                {[
                  '100% Private',
                  'ZK Native',
                  'Built on Aleo',
                  'Non-Custodial',
                  'Trustless',
                ].map((badge) => (
                  <span
                    key={badge}
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-midnight-900/90 text-amber-400 border border-amber-500/30 tracking-wide"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                    {badge}
                  </span>
                ))}
              </div>


            </motion.div>

            {/* Right content - Animated illustration */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="relative hidden lg:flex items-center justify-center"
            >
              <ZkCirclesIllustration />
            </motion.div>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="py-20 md:py-32 bg-cream-50/60 relative overflow-hidden">
        {/* Decorative elements */}
        <div className="absolute -top-20 -right-20 w-80 h-80 bg-amber-200/30 rounded-full blur-3xl" />
        <div className="absolute -bottom-20 -left-20 w-80 h-80 bg-forest-200/30 rounded-full blur-3xl" />
        
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="section-title mb-4">
              How It Works
            </h2>
            <p className="section-subtitle max-w-2xl mx-auto">
              Get started in minutes. No complex setup, no trust required.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {howItWorks.map((item, index) => (
              <motion.div
                key={item.step}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.15 }}
                className="relative"
              >
                {/* Connector line */}
                {index < howItWorks.length - 1 && (
                  <div className="hidden lg:block absolute top-10 left-[60%] w-full h-0.5 bg-gradient-to-r from-amber-300 to-transparent" />
                )}
                
                <div className="bg-white rounded-3xl p-6 shadow-warm border border-cream-200 relative group hover:border-amber-300 hover:shadow-amber-100/60 transition-all">
                  {/* NullPay-style two-digit step number */}
                  <div className="flex items-start gap-3 mb-4">
                    <span className="font-display text-4xl font-black text-amber-200 leading-none select-none group-hover:text-amber-300 transition-colors">
                      {String(item.step).padStart(2, '0')}
                    </span>
                  </div>
                  <h3 className="font-display text-lg font-semibold text-midnight-900 mb-2">
                    {item.title}
                  </h3>
                  <p className="text-midnight-600 text-sm">
                    {item.description}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mt-12"
          >
            <Link
              to="/how-it-works"
              className="btn-secondary inline-flex items-center gap-2"
            >
              Learn More
              <ArrowRight className="w-5 h-5" />
            </Link>
          </motion.div>
        </div>
      </section>

      {/* Traditional vs ZkCircles comparison — inspired by NullPay */}
      <section className="py-20 md:py-28 bg-midnight-950 relative overflow-hidden">
        <div className="absolute inset-0 opacity-5">
          <div className="absolute top-10 left-10 w-40 h-40 border border-amber-400 rounded-full" />
          <div className="absolute bottom-10 right-10 w-60 h-60 border border-forest-400 rounded-full" />
        </div>
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 relative">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <h2 className="font-display text-3xl md:text-4xl font-bold text-cream-50 mb-3">
              Privacy is{' '}
              <span className="text-amber-400">Not Optional</span>
            </h2>
            <p className="text-cream-400 text-lg">See how ZkCircles compares to traditional rotating savings.</p>
          </motion.div>

          <div className="grid md:grid-cols-2 gap-6">
            {/* Traditional */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="rounded-2xl border border-white/10 bg-white/5 p-8"
            >
              <h3 className="font-display text-lg font-semibold text-cream-300 mb-6 flex items-center gap-2">
                <XCircle className="w-5 h-5 text-red-400" />
                Traditional Savings Groups
              </h3>
              <ul className="space-y-3">
                {[
                  'All transactions visible to members',
                  'Identity and amounts exposed',
                  'Trust-based — no enforcement',
                  'Defaulters can disappear',
                  'No credit history proof',
                  'Single-point-of-failure organizer',
                ].map((item) => (
                  <li key={item} className="flex items-start gap-3 text-sm text-cream-400">
                    <XCircle className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </motion.div>

            {/* ZkCircles */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-8 relative"
            >
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 bg-amber-500 rounded-full text-xs font-bold text-midnight-900 tracking-wider">
                ZKCIRCLES PROTOCOL
              </div>
              <h3 className="font-display text-lg font-semibold text-amber-400 mb-6 flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-amber-400" />
                ZkCircles on Aleo
              </h3>
              <ul className="space-y-3">
                {[
                  'Contributions verified privately via ZK proofs',
                  'Member identities hashed — never stored',
                  'Smart contract enforces every payout',
                  'Defaults flagged on-chain automatically',
                  'Prove your history to lenders privately',
                  'Fully decentralised — no organizer risk',
                ].map((item) => (
                  <li key={item} className="flex items-start gap-3 text-sm text-cream-200">
                    <CheckCircle2 className="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </motion.div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 md:py-32 bg-midnight-950 relative overflow-hidden">
        {/* Background pattern */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-10 left-10 w-40 h-40 border-2 border-amber-400 rounded-full" />
          <div className="absolute bottom-10 right-10 w-60 h-60 border-2 border-forest-400 rounded-full" />
          <div className="absolute top-1/2 left-1/3 w-32 h-32 border-2 border-terra-400 rounded-full" />
        </div>

        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <Zap className="w-16 h-16 text-amber-400 mx-auto mb-6" />
            <h2 className="font-display text-3xl md:text-4xl lg:text-5xl font-bold text-cream-50 mb-6">
              Ready to Start Saving{' '}
              <span className="text-amber-400">Together</span>?
            </h2>
            <p className="text-lg text-cream-300 mb-8 max-w-2xl mx-auto">
              Join thousands of people around the world who are rediscovering 
              the power of community savings with the privacy of zero-knowledge proofs.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link to="/create" className="btn-primary">
                Create Your First Circle
              </Link>
              <Link to="/explorer" className="btn-secondary">
                Browse Active Circles
              </Link>
            </div>
          </motion.div>
        </div>
      </section>
    </div>
  )
}
