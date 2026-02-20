import { motion } from 'framer-motion'
import { 
  Shield, 
  Lock, 
  Eye,
  Key,
  Server,
  Code,
  CheckCircle2,
  ExternalLink
} from 'lucide-react'

export default function Privacy() {
  const privacyFeatures = [
    {
      icon: Lock,
      title: 'Private Records',
      description: 'Your membership, contributions, and payouts are stored as encrypted Aleo records. Only you can decrypt them with your private key.',
    },
    {
      icon: Shield,
      title: 'Zero-Knowledge Proofs',
      description: 'When you contribute or claim a payout, ZK proofs verify the transaction without revealing amounts, balances, or your identity.',
    },
    {
      icon: Eye,
      title: 'Selective Disclosure',
      description: 'Share view keys with auditors, lenders, or regulators to prove your participation history without giving spending access.',
    },
    {
      icon: Server,
      title: 'Off-Chain Execution',
      description: 'Transaction computations happen on your device, not on public servers. Only the proof goes to the blockchain.',
    },
  ]

  const technicalDetails = [
    {
      title: 'Record Model',
      content: 'ZkCircles uses Aleo\'s record model instead of transparent mappings. Each membership and contribution generates an encrypted record owned by you. The record\'s private fields (amounts, circle details) are encrypted using your address viewing key.',
    },
    {
      title: 'BHP256 Hashing',
      content: 'Circle IDs, member identities, and contribution keys are derived using BHP256, a hash function optimized for zero-knowledge circuits. This allows verification without revealing the underlying data.',
    },
    {
      title: 'Transfer Privacy',
      content: 'Fund movements use Aleo\'s native transfer_private function. This hides the sender, recipient, and amount from public view while still allowing consensus verification.',
    },
    {
      title: 'View Keys',
      content: 'Aleo\'s view keys allow selective disclosure. A view key can decrypt your transaction history without enabling spending. Perfect for proving creditworthiness or regulatory compliance.',
    },
  ]

  const faqs = [
    {
      question: 'Can other circle members see my wallet balance?',
      answer: 'No. All contributions are made privately. Members can only see that contributions were made, not amounts or wallet balances.',
    },
    {
      question: 'What data is stored on-chain?',
      answer: 'Only encrypted records and public circle metadata (number of members, cycle status). Sensitive data like contribution amounts and addresses are hashed or encrypted.',
    },
    {
      question: 'How does the circle verify my contribution without seeing it?',
      answer: 'Zero-knowledge proofs! When you contribute, your wallet generates a mathematical proof that your contribution is valid (correct amount, correct circle) without revealing the actual values.',
    },
    {
      question: 'Can I prove my savings history to a bank?',
      answer: 'Yes! Using your view key, you can give read-only access to your transaction history. The bank can verify your participation without you exposing your private key.',
    },
    {
      question: 'What if I lose my private key?',
      answer: 'Without your private key, you cannot access your records or funds. There is no recovery mechanism—this is the tradeoff for true privacy. Always backup your keys securely.',
    },
    {
      question: 'Are transactions reversible?',
      answer: 'No. Once a contribution or payout is confirmed on the Aleo blockchain, it cannot be reversed. The smart contract ensures fairness, but there\'s no undo button.',
    },
  ]

  return (
    <div className="min-h-screen bg-cream-50">
      {/* Hero */}
      <section className="relative py-20 md:py-32 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-midnight-950 to-midnight-900" />
        <div className="absolute inset-0 opacity-20">
          <div className="absolute top-20 left-1/4 w-64 h-64 border border-amber-400 rounded-full" />
          <div className="absolute bottom-20 right-1/4 w-48 h-48 border border-forest-400 rounded-full" />
        </div>
        
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 relative text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div className="inline-flex items-center justify-center w-20 h-20 bg-amber-500/20 rounded-full mb-6">
              <Shield className="w-10 h-10 text-amber-400" />
            </div>
            
            <h1 className="font-display text-4xl md:text-5xl font-bold text-cream-50 mb-6">
              Privacy by Design
            </h1>
            
            <p className="text-lg text-cream-300 max-w-2xl mx-auto">
              ZkCircles is built on Aleo, the first platform to offer fully private 
              smart contracts. Your financial activity remains yours alone.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Privacy Features */}
      <section className="py-16 md:py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="section-title">How We Protect You</h2>
            <p className="section-subtitle">Multiple layers of privacy protection</p>
          </motion.div>

          <div className="grid md:grid-cols-2 gap-8">
            {privacyFeatures.map((feature, index) => {
              const Icon = feature.icon
              return (
                <motion.div
                  key={feature.title}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.1 }}
                  className="card-hover"
                >
                  <div className="flex gap-4">
                    <div className="flex-shrink-0">
                      <div className="w-14 h-14 bg-amber-100 rounded-2xl flex items-center justify-center">
                        <Icon className="w-7 h-7 text-amber-600" />
                      </div>
                    </div>
                    <div>
                      <h3 className="font-display text-xl font-semibold text-midnight-900 mb-2">
                        {feature.title}
                      </h3>
                      <p className="text-midnight-600">
                        {feature.description}
                      </p>
                    </div>
                  </div>
                </motion.div>
              )
            })}
          </div>
        </div>
      </section>

      {/* Technical Deep Dive */}
      <section className="py-16 md:py-24 bg-cream-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-midnight-100 rounded-full mb-4">
              <Code className="w-4 h-4 text-midnight-600" />
              <span className="text-sm font-medium text-midnight-700">Technical Details</span>
            </div>
            <h2 className="section-title">Under the Hood</h2>
          </motion.div>

          <div className="space-y-6">
            {technicalDetails.map((detail, index) => (
              <motion.div
                key={detail.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className="card"
              >
                <h3 className="font-display text-lg font-semibold text-midnight-900 mb-3 flex items-center gap-2">
                  <Key className="w-5 h-5 text-amber-500" />
                  {detail.title}
                </h3>
                <p className="text-midnight-600">{detail.content}</p>
              </motion.div>
            ))}
          </div>

          {/* Link to Aleo docs */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mt-8 text-center"
          >
            <a
              href="https://developer.aleo.org/"
              target="_blank"
              rel="noopener noreferrer"
              className="btn-secondary inline-flex items-center gap-2"
            >
              Learn More About Aleo
              <ExternalLink className="w-4 h-4" />
            </a>
          </motion.div>
        </div>
      </section>

      {/* FAQs */}
      <section className="py-16 md:py-24 bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <h2 className="section-title">Privacy FAQs</h2>
            <p className="section-subtitle">Common questions about ZkCircles privacy</p>
          </motion.div>

          <div className="space-y-4">
            {faqs.map((faq, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.05 }}
                className="card"
              >
                <h3 className="font-display font-semibold text-midnight-900 mb-2 flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-forest-500 flex-shrink-0 mt-0.5" />
                  {faq.question}
                </h3>
                <p className="text-midnight-600 ml-8">{faq.answer}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Security Practices */}
      <section className="py-16 md:py-24 bg-midnight-950">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <Lock className="w-16 h-16 text-amber-400 mx-auto mb-6" />
            <h2 className="font-display text-3xl md:text-4xl font-bold text-cream-50 mb-6">
              Your Keys, Your Funds
            </h2>
            <p className="text-cream-300 mb-8 max-w-2xl mx-auto">
              ZkCircles never has access to your private keys. Your wallet manages all 
              cryptographic operations locally. We can't see your data, and neither can anyone else.
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              <div className="px-6 py-3 bg-midnight-800 rounded-xl text-cream-200 text-sm">
                Non-Custodial
              </div>
              <div className="px-6 py-3 bg-midnight-800 rounded-xl text-cream-200 text-sm">
                Open Source
              </div>
              <div className="px-6 py-3 bg-midnight-800 rounded-xl text-cream-200 text-sm">
                Auditable
              </div>
              <div className="px-6 py-3 bg-midnight-800 rounded-xl text-cream-200 text-sm">
                No Tracking
              </div>
            </div>
          </motion.div>
        </div>
      </section>
    </div>
  )
}
