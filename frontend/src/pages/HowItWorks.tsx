import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { 
  Users, 
  Coins, 
  Trophy, 
  Shield,
  Zap,
  ArrowRight,
  CircleDot,
  CheckCircle2,
  Globe,
  Lock
} from 'lucide-react'

export default function HowItWorks() {
  const steps = [
    {
      step: 1,
      icon: Users,
      title: 'Form Your Circle',
      description: 'Create a new savings circle or join an existing one. Set the contribution amount, number of members, and cycle duration. Your circle starts when all spots are filled.',
      details: [
        '2-12 members per circle',
        'Flexible contribution amounts',
        'Daily, weekly, or monthly cycles',
      ],
    },
    {
      step: 2,
      icon: Coins,
      title: 'Contribute Each Cycle',
      description: 'Every cycle, each member contributes the agreed amount to the pool. Your contribution is verified with zero-knowledge proofs, keeping your financial activity private.',
      details: [
        'Private contribution receipts',
        'ZK-verified without exposing amounts',
        'Automatic enforcement by smart contract',
      ],
    },
    {
      step: 3,
      icon: Trophy,
      title: 'Receive Your Payout',
      description: 'Members take turns receiving the pooled funds. The order is determined by your join position. When it\'s your turn, you receive the entire pot!',
      details: [
        'Fair, transparent rotation',
        'Full pot each cycle',
        'Guaranteed by smart contract',
      ],
    },
    {
      step: 4,
      icon: CheckCircle2,
      title: 'Complete the Circle',
      description: 'Once everyone has received their payout, the circle is complete. You\'ve successfully saved and built a verifiable track record on-chain.',
      details: [
        'Build credit history',
        'Selective disclosure with view keys',
        'Start another circle anytime',
      ],
    },
  ]

  const benefits = [
    {
      icon: Shield,
      title: 'Complete Privacy',
      description: 'Your contributions, balances, and payout history are encrypted. Only you can see your financial activity.',
    },
    {
      icon: Lock,
      title: 'Trustless Security',
      description: 'Smart contracts enforce the rules. No single person can run off with the funds or cheat the system.',
    },
    {
      icon: Zap,
      title: 'Zero-Knowledge Proofs',
      description: 'Aleo\'s ZK technology verifies everything mathematically without revealing sensitive data.',
    },
    {
      icon: Globe,
      title: 'Global Access',
      description: 'Anyone with an Aleo wallet can participate. No credit checks, no banking requirements.',
    },
  ]

  const comparisons = [
    { feature: 'Privacy', traditional: 'Everyone sees your activity', zkCircles: 'Fully encrypted' },
    { feature: 'Trust', traditional: 'Rely on social pressure', zkCircles: 'Enforced by smart contracts' },
    { feature: 'Default Risk', traditional: 'Members can disappear', zkCircles: 'Funds locked until completion' },
    { feature: 'Geographic Reach', traditional: 'Local community only', zkCircles: 'Global participation' },
    { feature: 'Credit Building', traditional: 'Informal, no proof', zkCircles: 'Verifiable on-chain history' },
    { feature: 'Transparency', traditional: 'Manual record keeping', zkCircles: 'Auditable by view keys' },
  ]

  return (
    <div className="min-h-screen bg-cream-50">
      {/* Hero */}
      <section className="relative py-20 md:py-32 overflow-hidden">
        <div className="absolute inset-0 bg-hero-gradient" />
        <div className="absolute inset-0 bg-pattern-circles opacity-30" />
        
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center max-w-3xl mx-auto"
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-amber-100 rounded-full mb-6">
              <CircleDot className="w-4 h-4 text-amber-600" />
              <span className="text-sm font-medium text-amber-800">
                Ancient Wisdom, Modern Technology
              </span>
            </div>
            
            <h1 className="font-display text-4xl md:text-5xl lg:text-6xl font-bold text-midnight-900 mb-6">
              How ZkCircles{' '}
              <span className="text-gradient-warm">Works</span>
            </h1>
            
            <p className="text-lg md:text-xl text-midnight-600">
              ZkCircles combines the time-tested rotating savings model used by millions 
              globally with Aleo's cutting-edge zero-knowledge technology.
            </p>
          </motion.div>
        </div>
      </section>

      {/* What is a ROSCA */}
      <section className="py-16 md:py-24 bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="section-title text-center mb-6">
              What is a Rotating Savings Circle?
            </h2>
            <div className="card">
              <p className="text-midnight-700 text-lg leading-relaxed mb-6">
                Rotating Savings and Credit Associations (ROSCAs) are one of humanity's 
                oldest and most widespread financial institutions. Known by many names—
                <span className="font-semibold text-terra-600">tandas</span> in Latin America, 
                <span className="font-semibold text-terra-600"> chamas</span> in East Africa, 
                <span className="font-semibold text-terra-600"> stokvels</span> in South Africa, 
                <span className="font-semibold text-terra-600"> susus</span> in West Africa—
                these groups represent the original "peer-to-peer finance."
              </p>
              <p className="text-midnight-700 text-lg leading-relaxed">
                A group of people agree to contribute a fixed amount regularly. Each period, 
                the collected pool goes to one member. This rotation continues until everyone 
                has received the pot, then the cycle can restart.
              </p>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Steps */}
      <section className="py-16 md:py-24 bg-cream-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="section-title">The Process</h2>
            <p className="section-subtitle">Simple steps, powerful results</p>
          </motion.div>

          <div className="space-y-12">
            {steps.map((step, index) => {
              const Icon = step.icon
              const isEven = index % 2 === 0

              return (
                <motion.div
                  key={step.step}
                  initial={{ opacity: 0, x: isEven ? -50 : 50 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.1 }}
                  className={`flex flex-col ${isEven ? 'md:flex-row' : 'md:flex-row-reverse'} items-center gap-8`}
                >
                  {/* Number and Icon */}
                  <div className="flex-shrink-0">
                    <div className="relative">
                      <div className="w-24 h-24 bg-gradient-to-br from-amber-400 to-amber-600 rounded-full flex items-center justify-center shadow-glow-amber">
                        <Icon className="w-10 h-10 text-white" />
                      </div>
                      <div className="absolute -top-2 -right-2 w-10 h-10 bg-midnight-900 rounded-full flex items-center justify-center text-white font-display font-bold">
                        {step.step}
                      </div>
                    </div>
                  </div>

                  {/* Content */}
                  <div className={`flex-1 ${isEven ? 'md:text-left' : 'md:text-right'}`}>
                    <h3 className="font-display text-2xl font-semibold text-midnight-900 mb-3">
                      {step.title}
                    </h3>
                    <p className="text-midnight-600 mb-4 max-w-xl">
                      {step.description}
                    </p>
                    <ul className={`space-y-2 ${isEven ? '' : 'md:ml-auto'} max-w-md`}>
                      {step.details.map((detail, i) => (
                        <li key={i} className="flex items-center gap-2 text-sm text-midnight-700">
                          <CheckCircle2 className="w-4 h-4 text-forest-500 flex-shrink-0" />
                          {detail}
                        </li>
                      ))}
                    </ul>
                  </div>
                </motion.div>
              )
            })}
          </div>
        </div>
      </section>

      {/* Benefits */}
      <section className="py-16 md:py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="section-title">Why ZkCircles?</h2>
            <p className="section-subtitle">The advantages of blockchain-based savings</p>
          </motion.div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {benefits.map((benefit, index) => {
              const Icon = benefit.icon
              return (
                <motion.div
                  key={benefit.title}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.1 }}
                  className="card-hover text-center"
                >
                  <div className="w-16 h-16 bg-amber-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <Icon className="w-8 h-8 text-amber-600" />
                  </div>
                  <h3 className="font-display text-lg font-semibold text-midnight-900 mb-2">
                    {benefit.title}
                  </h3>
                  <p className="text-midnight-600 text-sm">
                    {benefit.description}
                  </p>
                </motion.div>
              )
            })}
          </div>
        </div>
      </section>

      {/* Comparison Table */}
      <section className="py-16 md:py-24 bg-cream-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <h2 className="section-title">Traditional vs ZkCircles</h2>
            <p className="section-subtitle">See how we improve on the classic model</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="card overflow-hidden"
          >
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-cream-200">
                    <th className="text-left py-4 px-4 font-display font-semibold text-midnight-900">
                      Feature
                    </th>
                    <th className="text-left py-4 px-4 font-display font-semibold text-midnight-500">
                      Traditional ROSCAs
                    </th>
                    <th className="text-left py-4 px-4 font-display font-semibold text-amber-600">
                      ZkCircles
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {comparisons.map((row, index) => (
                    <tr key={row.feature} className={index < comparisons.length - 1 ? 'border-b border-cream-100' : ''}>
                      <td className="py-4 px-4 font-medium text-midnight-900">
                        {row.feature}
                      </td>
                      <td className="py-4 px-4 text-midnight-500">
                        {row.traditional}
                      </td>
                      <td className="py-4 px-4 text-forest-700 font-medium flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-forest-500" />
                        {row.zkCircles}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </motion.div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 md:py-24 bg-midnight-950">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="font-display text-3xl md:text-4xl font-bold text-cream-50 mb-6">
              Ready to Start Your Circle?
            </h2>
            <p className="text-cream-300 mb-8 max-w-2xl mx-auto">
              Join the future of community finance. Create a circle, invite your 
              friends and family, and start saving together with complete privacy.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link to="/create" className="btn-primary inline-flex items-center justify-center gap-2">
                Create a Circle
                <ArrowRight className="w-5 h-5" />
              </Link>
              <Link to="/explorer" className="btn-secondary inline-flex items-center justify-center gap-2">
                Explore Circles
              </Link>
            </div>
          </motion.div>
        </div>
      </section>
    </div>
  )
}
