import { Link } from 'react-router-dom'
import { useWallet } from '@provablehq/aleo-wallet-adaptor-react'
import { motion } from 'framer-motion'
import { 
  Users, 
  Shield, 
  Zap, 
  Globe, 
  ArrowRight, 
  Lock,
  Eye,
  Coins,
  CircleDot
} from 'lucide-react'

export default function Home() {
  const { connected } = useWallet()

  const features = [
    {
      icon: Shield,
      title: 'Zero-Knowledge Privacy',
      description: 'Your contributions, payouts, and financial history remain completely private through Aleo\'s ZK proofs.',
      color: 'amber',
    },
    {
      icon: Lock,
      title: 'Trustless Guarantees',
      description: 'Smart contracts ensure every member contributes and receives their fair share. No more defaults.',
      color: 'forest',
    },
    {
      icon: Eye,
      title: 'Selective Disclosure',
      description: 'Share view keys with auditors or lenders to prove your savings history without exposing everything.',
      color: 'terra',
    },
    {
      icon: Globe,
      title: 'Global Access',
      description: 'Join savings circles from anywhere. No banks, no borders, just community.',
      color: 'amber',
    },
  ]

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

  const stats = [
    { value: '100%', label: 'Privacy Preserved' },
    { value: '0', label: 'Trust Required' },
    { value: '∞', label: 'Global Reach' },
  ]

  return (
    <div className="overflow-hidden">
      {/* Hero Section */}
      <section className="relative min-h-[90vh] flex items-center">
        {/* Background decorations */}
        <div className="absolute inset-0 bg-hero-gradient" />
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

              {/* Stats */}
              <div className="grid grid-cols-3 gap-6">
                {stats.map((stat, index) => (
                  <motion.div
                    key={stat.label}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 + index * 0.1 }}
                    className="text-center"
                  >
                    <div className="font-display text-2xl md:text-3xl font-bold text-amber-600">
                      {stat.value}
                    </div>
                    <div className="text-sm text-midnight-500">{stat.label}</div>
                  </motion.div>
                ))}
              </div>
            </motion.div>

            {/* Right content - Animated illustration */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="relative hidden lg:block"
            >
              <div className="relative w-[400px] h-[400px] mx-auto">
                {/* Outer decorative ring */}
                <div className="absolute inset-4 rounded-full border-2 border-dashed border-amber-200 opacity-60" />
                <div className="absolute inset-12 rounded-full border-2 border-dashed border-amber-300 opacity-40" />
                
                {/* Central pot */}
                <motion.div
                  className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-28 h-28 bg-gradient-to-br from-amber-400 to-amber-600 rounded-full shadow-xl flex items-center justify-center z-10"
                  animate={{ scale: [1, 1.05, 1] }}
                  transition={{ duration: 3, repeat: Infinity }}
                >
                  <Coins className="w-10 h-10 text-white" />
                </motion.div>

                {/* Member circles - positioned on the ring */}
                {[0, 60, 120, 180, 240, 300].map((angle, index) => {
                  const radius = 150 // distance from center
                  const x = Math.cos((angle - 90) * Math.PI / 180) * radius
                  const y = Math.sin((angle - 90) * Math.PI / 180) * radius
                  return (
                    <motion.div
                      key={angle}
                      className="absolute w-14 h-14 bg-gradient-to-br from-terra-400 to-terra-600 rounded-full shadow-lg flex items-center justify-center"
                      style={{
                        top: `calc(50% + ${y}px)`,
                        left: `calc(50% + ${x}px)`,
                        transform: 'translate(-50%, -50%)',
                      }}
                      animate={{ 
                        scale: [1, 1.15, 1],
                        boxShadow: [
                          '0 4px 6px rgba(0,0,0,0.1)',
                          '0 8px 15px rgba(0,0,0,0.2)',
                          '0 4px 6px rgba(0,0,0,0.1)'
                        ]
                      }}
                      transition={{ duration: 2, repeat: Infinity, delay: index * 0.4 }}
                    >
                      <Users className="w-5 h-5 text-white" />
                    </motion.div>
                  )
                })}

                {/* Connection lines */}
                <svg className="absolute inset-0 w-full h-full" style={{ zIndex: 0 }}>
                  <defs>
                    <linearGradient id="lineGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#F59E0B" stopOpacity="0.3" />
                      <stop offset="50%" stopColor="#F59E0B" stopOpacity="0.6" />
                      <stop offset="100%" stopColor="#F59E0B" stopOpacity="0.3" />
                    </linearGradient>
                  </defs>
                  <circle 
                    cx="200" 
                    cy="200" 
                    r="150" 
                    fill="none" 
                    stroke="url(#lineGradient)" 
                    strokeWidth="2" 
                    strokeDasharray="8 8"
                    className="animate-spin-slow"
                    style={{ transformOrigin: 'center' }}
                  />
                </svg>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 md:py-32 bg-white relative">
        <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-b from-cream-50 to-white" />
        
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="section-title mb-4">
              Why Choose ZkCircles?
            </h2>
            <p className="section-subtitle max-w-2xl mx-auto">
              We combine the trusted tradition of community savings with cutting-edge 
              privacy technology to create something truly revolutionary.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 md:gap-8">
            {features.map((feature, index) => {
              const Icon = feature.icon
              const colorClasses = {
                amber: 'bg-amber-100 text-amber-600 group-hover:bg-amber-200',
                forest: 'bg-forest-100 text-forest-600 group-hover:bg-forest-200',
                terra: 'bg-terra-100 text-terra-600 group-hover:bg-terra-200',
              }
              
              return (
                <motion.div
                  key={feature.title}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.1 }}
                  className="card-hover group"
                >
                  <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-4 transition-colors ${colorClasses[feature.color as keyof typeof colorClasses]}`}>
                    <Icon className="w-7 h-7" />
                  </div>
                  <h3 className="font-display text-xl font-semibold text-midnight-900 mb-2">
                    {feature.title}
                  </h3>
                  <p className="text-midnight-600">
                    {feature.description}
                  </p>
                </motion.div>
              )
            })}
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="py-20 md:py-32 bg-cream-50 relative overflow-hidden">
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
                
                <div className="bg-white rounded-3xl p-6 shadow-warm border border-cream-200 relative">
                  <div className="w-12 h-12 bg-gradient-to-br from-amber-500 to-amber-600 rounded-full flex items-center justify-center text-white font-display font-bold text-lg mb-4">
                    {item.step}
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
