import { Link } from 'react-router-dom'
import { useWallet } from '@provablehq/aleo-wallet-adaptor-react'
import { motion } from 'framer-motion'
import { 
  Zap, 
  ArrowRight, 
  CircleDot,
  CheckCircle2,
  XCircle,
  Shield,
  Users,
  Coins,
  Globe,
  Play,
  TrendingUp,
  Banknote,
  Lock
} from 'lucide-react'
import PageTransition from '../components/PageTransition'
import AnimatedCounter from '../components/AnimatedCounter'

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
    <PageTransition>
    <div className="overflow-hidden">
      {/* Hero Section — full bleed wallpaper */}
      <section className="relative min-h-[92vh] flex items-center overflow-hidden">
        {/* Full background wallpaper image */}
        <div
          className="absolute inset-0 bg-cover bg-center bg-no-repeat"
          style={{ backgroundImage: "url('/wallpaper.png')" }}
        />
        {/* Dark overlay for text readability */}
        <div className="absolute inset-0 bg-gradient-to-r from-midnight-950/85 via-midnight-950/60 to-midnight-950/30" />
        {/* Bottom fade */}
        <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-midnight-950 to-transparent" />

        {/* Floating circle accents */}
        <motion.div
          className="absolute top-20 right-[15%] w-64 h-64 rounded-full border border-amber-400/10"
          animate={{ rotate: 360 }}
          transition={{ duration: 40, repeat: Infinity, ease: 'linear' }}
        />
        <motion.div
          className="absolute bottom-32 right-[10%] w-40 h-40 rounded-full border border-amber-300/10"
          animate={{ rotate: -360 }}
          transition={{ duration: 30, repeat: Infinity, ease: 'linear' }}
        />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 w-full">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* Left content */}
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.7, ease: [0.25, 0.4, 0.25, 1] }}
            >
              <motion.div 
                className="inline-flex items-center gap-2 px-4 py-2 bg-amber-500/15 backdrop-blur-md rounded-full mb-8 border border-amber-400/30"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
              >
                <CircleDot className="w-4 h-4 text-amber-400" />
                <span className="text-sm font-medium text-amber-200">
                  Powered by Aleo Zero-Knowledge Proofs
                </span>
              </motion.div>

              {/* Large hero typography — inspired by ref image split style */}
              <h1 className="font-display font-bold leading-[0.95] mb-6">
                <motion.span 
                  className="block text-5xl md:text-7xl lg:text-8xl text-cream-50 tracking-widest uppercase"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.15, duration: 0.6 }}
                >
                  Private
                </motion.span>
                <motion.span 
                  className="block text-5xl md:text-7xl lg:text-8xl text-amber-400 tracking-widest uppercase"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3, duration: 0.6 }}
                >
                  Savings
                </motion.span>
              </h1>

              <motion.p 
                className="text-lg md:text-xl text-cream-300 mb-8 max-w-lg leading-relaxed"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
              >
                Trustless rotating savings circles with on-chain credit scores and peer-to-peer lending.
              </motion.p>

              <motion.div 
                className="flex flex-col sm:flex-row gap-4 mb-10"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
              >
                {connected ? (
                  <>
                    <Link to="/create" className="px-8 py-3.5 bg-amber-500 hover:bg-amber-600 text-midnight-950 font-bold rounded-2xl shadow-glow-amber transition-all duration-300 hover:-translate-y-0.5 flex items-center justify-center gap-2 glow-pulse">
                      Create a Circle
                      <ArrowRight className="w-5 h-5" />
                    </Link>
                    <Link to="/join" className="px-8 py-3.5 bg-white/10 backdrop-blur-sm hover:bg-white/20 text-cream-50 font-semibold rounded-2xl border border-white/20 transition-all duration-300 hover:-translate-y-0.5 flex items-center justify-center gap-2">
                      Join a Circle
                    </Link>
                  </>
                ) : (
                  <>
                    <Link to="/how-it-works" className="px-8 py-3.5 bg-amber-500 hover:bg-amber-600 text-midnight-950 font-bold rounded-2xl shadow-glow-amber transition-all duration-300 hover:-translate-y-0.5 flex items-center justify-center gap-2 glow-pulse">
                      Explore Circles
                      <ArrowRight className="w-5 h-5" />
                    </Link>
                    <a href="https://youtu.be/AGZZAXuah-g" target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 text-cream-200 hover:text-amber-400 transition-colors duration-300 group">
                      <span className="w-12 h-12 rounded-full border-2 border-cream-300 group-hover:border-amber-400 flex items-center justify-center transition-colors duration-300">
                        <Play className="w-5 h-5 ml-0.5" />
                      </span>
                      <span className="font-medium">Watch Video</span>
                    </a>
                  </>
                )}
              </motion.div>

              {/* Trust badges */}
              <motion.div 
                className="flex flex-wrap gap-2"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.6 }}
              >
                {[
                  '100% Private',
                  'ZK Native',
                  'Built on Aleo',
                  'Non-Custodial',
                  'Trustless',
                ].map((badge, i) => (
                  <motion.span
                    key={badge}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-white/5 text-amber-300 border border-amber-500/20 tracking-wide backdrop-blur-sm"
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.6 + i * 0.08 }}
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                    {badge}
                  </motion.span>
                ))}
              </motion.div>
            </motion.div>

            {/* Right content — feature highlight cards */}
            <motion.div
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.7, delay: 0.4, ease: [0.25, 0.4, 0.25, 1] }}
              className="relative hidden lg:flex flex-col gap-4"
            >
              {[
                {
                  icon: Users,
                  title: 'Savings Circles',
                  desc: 'Pool funds with your community. Trustless payouts every cycle.',
                  accent: 'amber',
                },
                {
                  icon: TrendingUp,
                  title: 'Credit Score',
                  desc: 'Build on-chain reputation. Every contribution counts.',
                  accent: 'forest',
                },
                {
                  icon: Banknote,
                  title: 'P2P Lending',
                  desc: 'Borrow and lend backed by your verified credit history.',
                  accent: 'amber',
                },
              ].map((card, i) => (
                <motion.div
                  key={card.title}
                  initial={{ opacity: 0, x: 40 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.5 + i * 0.15, duration: 0.5, ease: [0.25, 0.4, 0.25, 1] }}
                  className="group flex items-start gap-4 p-5 rounded-2xl bg-white/[0.06] backdrop-blur-md border border-white/10 hover:border-amber-400/30 hover:bg-white/[0.1] transition-all duration-300"
                >
                  <div className={`flex-shrink-0 w-11 h-11 rounded-xl flex items-center justify-center ${
                    card.accent === 'forest'
                      ? 'bg-forest-500/20 text-forest-400'
                      : 'bg-amber-500/20 text-amber-400'
                  }`}>
                    <card.icon className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-cream-50 font-semibold text-base mb-1">{card.title}</h3>
                    <p className="text-cream-400 text-sm leading-relaxed">{card.desc}</p>
                  </div>
                </motion.div>
              ))}

              {/* Decorative lock badge */}
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 1, type: 'spring', stiffness: 200 }}
                className="flex items-center gap-2 self-end mt-2 px-4 py-2 rounded-full bg-amber-500/10 border border-amber-500/20 backdrop-blur-sm"
              >
                <Lock className="w-3.5 h-3.5 text-amber-400" />
                <span className="text-xs font-medium text-amber-300">Zero-Knowledge Protected</span>
              </motion.div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Live Stats Band */}
      <section className="relative py-6 bg-midnight-950 border-y border-amber-500/20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {[
              { icon: Users, value: 24, label: 'On-chain Transitions', suffix: '' },
              { icon: Shield, value: 17, label: 'Privacy Mappings', suffix: '' },
              { icon: Coins, value: 3, label: 'Supported Tokens', suffix: '' },
              { icon: Globe, value: 0, label: 'Plain Addresses Stored', suffix: '' },
            ].map((stat, i) => (
              <motion.div
                key={stat.label}
                className="text-center"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
              >
                <stat.icon className="w-5 h-5 text-amber-400/70 mx-auto mb-2" />
                <div className="font-display text-2xl md:text-3xl font-bold text-cream-50">
                  <AnimatedCounter value={stat.value} suffix={stat.suffix} />
                </div>
                <div className="text-xs text-cream-400 mt-1">{stat.label}</div>
              </motion.div>
            ))}
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
                transition={{ delay: index * 0.12, ease: [0.25, 0.4, 0.25, 1] }}
                className="relative"
              >
                {/* Connector line */}
                {index < howItWorks.length - 1 && (
                  <div className="hidden lg:block absolute top-10 left-[60%] w-full h-px bg-gradient-to-r from-amber-300/60 to-transparent" />
                )}
                
                <div className="bg-white/90 backdrop-blur-sm rounded-3xl p-6 shadow-warm border border-cream-200 relative group hover:border-amber-300 hover:shadow-warm-lg hover:-translate-y-2 transition-all duration-500">
                  {/* Step number */}
                  <div className="flex items-start gap-3 mb-4">
                    <span className="font-display text-4xl font-black text-amber-200/80 leading-none select-none group-hover:text-amber-300 transition-colors duration-300">
                      {String(item.step).padStart(2, '0')}
                    </span>
                  </div>
                  <h3 className="font-display text-lg font-semibold text-midnight-900 mb-2">
                    {item.title}
                  </h3>
                  <p className="text-midnight-600 text-sm leading-relaxed">
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

      {/* Traditional vs ZkCircles comparison */}
      <section className="py-20 md:py-28 bg-midnight-950 relative overflow-hidden">
        <div className="absolute inset-0 opacity-[0.03]">
          <div className="absolute top-10 left-10 w-40 h-40 border border-amber-400 rounded-full" />
          <div className="absolute bottom-10 right-10 w-60 h-60 border border-forest-400 rounded-full" />
        </div>
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 relative">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ ease: [0.25, 0.4, 0.25, 1] }}
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
              transition={{ ease: [0.25, 0.4, 0.25, 1] }}
              className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm p-8 hover:bg-white/[0.07] transition-colors duration-300"
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
                    <XCircle className="w-4 h-4 text-red-400/80 mt-0.5 flex-shrink-0" />
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
              transition={{ ease: [0.25, 0.4, 0.25, 1] }}
              className="rounded-2xl border border-amber-500/30 bg-amber-500/5 backdrop-blur-sm p-8 relative hover:border-amber-500/50 hover:bg-amber-500/[0.08] transition-all duration-300"
            >
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 bg-gradient-to-r from-amber-500 to-amber-600 rounded-full text-xs font-bold text-midnight-900 tracking-wider shadow-glow-amber">
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
        <div className="absolute inset-0 opacity-[0.06]">
          <div className="absolute top-10 left-10 w-40 h-40 border-2 border-amber-400 rounded-full" />
          <div className="absolute bottom-10 right-10 w-60 h-60 border-2 border-forest-400 rounded-full" />
          <div className="absolute top-1/2 left-1/3 w-32 h-32 border-2 border-terra-400 rounded-full" />
        </div>

        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ ease: [0.25, 0.4, 0.25, 1] }}
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              whileInView={{ scale: 1, opacity: 1 }}
              viewport={{ once: true }}
              transition={{ type: 'spring', stiffness: 200, damping: 15 }}
            >
              <Zap className="w-16 h-16 text-amber-400 mx-auto mb-6" />
            </motion.div>
            <h2 className="font-display text-3xl md:text-4xl lg:text-5xl font-bold text-cream-50 mb-6">
              Ready to Start Saving{' '}
              <span className="text-gradient-gold">Together</span>?
            </h2>
            <p className="text-lg text-cream-300 mb-8 max-w-2xl mx-auto leading-relaxed">
              Join thousands of people around the world who are rediscovering 
              the power of community savings with the privacy of zero-knowledge proofs.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link to="/create" className="btn-primary glow-pulse">
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
    </PageTransition>
  )
}
