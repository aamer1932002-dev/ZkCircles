import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useWallet } from '@provablehq/aleo-wallet-adaptor-react'
import { motion } from 'framer-motion'
import { toast } from 'react-hot-toast'
import { 
  Plus, 
  Users, 
  Clock, 
  Coins, 
  Info,
  Loader2,
  CheckCircle2
} from 'lucide-react'
import { useCreateCircle } from '../hooks/useCreateCircle'

export default function CreateCircle() {
  const navigate = useNavigate()
  const { connected } = useWallet()
  const { createCircle, isCreating, transactionStatus } = useCreateCircle()

  const [formData, setFormData] = useState({
    name: '',
    contributionAmount: '',
    maxMembers: '6',
    cycleDuration: '7', // days
  })

  const [errors, setErrors] = useState<Record<string, string>>({})

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }))
    }
  }

  const validateForm = () => {
    const newErrors: Record<string, string> = {}

    if (!formData.name.trim()) {
      newErrors.name = 'Circle name is required'
    } else if (formData.name.length < 3) {
      newErrors.name = 'Name must be at least 3 characters'
    }

    if (!formData.contributionAmount) {
      newErrors.contributionAmount = 'Contribution amount is required'
    } else if (parseFloat(formData.contributionAmount) < 0.001) {
      newErrors.contributionAmount = 'Minimum contribution is 0.001 ALEO'
    }

    const members = parseInt(formData.maxMembers)
    if (members < 2 || members > 12) {
      newErrors.maxMembers = 'Members must be between 2 and 12'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!connected) {
      toast.error('Please connect your wallet first')
      return
    }

    if (!validateForm()) {
      toast.error('Please fix the errors in the form')
      return
    }

    try {
      // Convert contribution amount to microcredits (1 ALEO = 1,000,000 microcredits)
      const contributionMicrocredits = Math.floor(
        parseFloat(formData.contributionAmount) * 1_000_000
      )
      
      // Convert cycle duration from days to approximate block count
      // Assuming ~1 block per 3.6 seconds, ~24000 blocks per day
      const cycleBlocks = parseInt(formData.cycleDuration) * 24000

      const result = await createCircle({
        name: formData.name,
        contributionAmount: contributionMicrocredits,
        maxMembers: parseInt(formData.maxMembers),
        cycleDurationBlocks: cycleBlocks,
      })

      if (result.success) {
        toast.success('Circle created successfully!')
        navigate(`/circle/${result.circleId}`)
      }
    } catch (error) {
      console.error('Failed to create circle:', error)
      toast.error('Failed to create circle. Please try again.')
    }
  }

  // Calculate total pot size
  const totalPot = formData.contributionAmount && formData.maxMembers
    ? (parseFloat(formData.contributionAmount) * parseInt(formData.maxMembers)).toFixed(3)
    : '0'

  if (!connected) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center"
        >
          <div className="w-20 h-20 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <Users className="w-10 h-10 text-amber-600" />
          </div>
          <h2 className="font-display text-2xl font-semibold text-midnight-900 mb-3">
            Connect Your Wallet
          </h2>
          <p className="text-midnight-600 mb-6 max-w-md">
            To create a savings circle, please connect your Aleo wallet first.
          </p>
        </motion.div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-cream-50 py-12 md:py-20">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="font-display text-3xl md:text-4xl font-bold text-midnight-900 mb-2">
            Create a Savings Circle
          </h1>
          <p className="text-midnight-600">
            Set up your community savings group in just a few steps.
          </p>
        </motion.div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Form */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="lg:col-span-2"
          >
            <form onSubmit={handleSubmit} className="card space-y-6">
              {/* Circle Name */}
              <div>
                <label htmlFor="name" className="input-label">
                  Circle Name
                </label>
                <input
                  type="text"
                  id="name"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  placeholder="e.g., Family Savings, Neighborhood Fund"
                  className={`input ${errors.name ? 'border-terra-500 focus:border-terra-500' : ''}`}
                  disabled={isCreating}
                />
                {errors.name && (
                  <p className="mt-1 text-sm text-terra-600">{errors.name}</p>
                )}
              </div>

              {/* Contribution Amount */}
              <div>
                <label htmlFor="contributionAmount" className="input-label">
                  Contribution Per Cycle (ALEO)
                </label>
                <div className="relative">
                  <Coins className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-midnight-400" />
                  <input
                    type="number"
                    id="contributionAmount"
                    name="contributionAmount"
                    value={formData.contributionAmount}
                    onChange={handleInputChange}
                    placeholder="0.00"
                    step="0.001"
                    min="0.001"
                    className={`input pl-12 ${errors.contributionAmount ? 'border-terra-500' : ''}`}
                    disabled={isCreating}
                  />
                </div>
                {errors.contributionAmount && (
                  <p className="mt-1 text-sm text-terra-600">{errors.contributionAmount}</p>
                )}
                <p className="mt-1 text-sm text-midnight-500">
                  Each member contributes this amount every cycle
                </p>
              </div>

              {/* Max Members */}
              <div>
                <label htmlFor="maxMembers" className="input-label">
                  Number of Members
                </label>
                <div className="relative">
                  <Users className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-midnight-400" />
                  <select
                    id="maxMembers"
                    name="maxMembers"
                    value={formData.maxMembers}
                    onChange={handleInputChange}
                    className="input pl-12 appearance-none cursor-pointer"
                    disabled={isCreating}
                  >
                    {[2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(num => (
                      <option key={num} value={num}>
                        {num} members
                      </option>
                    ))}
                  </select>
                </div>
                <p className="mt-1 text-sm text-midnight-500">
                  Including yourself. Circle starts when full.
                </p>
              </div>

              {/* Cycle Duration */}
              <div>
                <label htmlFor="cycleDuration" className="input-label">
                  Cycle Duration
                </label>
                <div className="relative">
                  <Clock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-midnight-400" />
                  <select
                    id="cycleDuration"
                    name="cycleDuration"
                    value={formData.cycleDuration}
                    onChange={handleInputChange}
                    className="input pl-12 appearance-none cursor-pointer"
                    disabled={isCreating}
                  >
                    <option value="1">Daily</option>
                    <option value="7">Weekly</option>
                    <option value="14">Bi-weekly</option>
                    <option value="30">Monthly</option>
                  </select>
                </div>
                <p className="mt-1 text-sm text-midnight-500">
                  Time between each contribution round
                </p>
              </div>

              {/* Transaction Status */}
              {isCreating && transactionStatus && (
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl">
                  <div className="flex items-center gap-3">
                    {transactionStatus === 'Completed' ? (
                      <CheckCircle2 className="w-5 h-5 text-forest-600" />
                    ) : (
                      <Loader2 className="w-5 h-5 text-amber-600 animate-spin" />
                    )}
                    <span className="text-amber-800 font-medium">
                      {transactionStatus}
                    </span>
                  </div>
                </div>
              )}

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isCreating}
                className="btn-primary w-full flex items-center justify-center gap-2"
              >
                {isCreating ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Creating Circle...
                  </>
                ) : (
                  <>
                    <Plus className="w-5 h-5" />
                    Create Circle
                  </>
                )}
              </button>
            </form>
          </motion.div>

          {/* Summary Card */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="lg:col-span-1"
          >
            <div className="card sticky top-24">
              <h3 className="font-display text-lg font-semibold text-midnight-900 mb-4">
                Circle Summary
              </h3>

              <div className="space-y-4">
                <div className="flex justify-between items-center py-3 border-b border-cream-200">
                  <span className="text-midnight-600">Members</span>
                  <span className="font-semibold text-midnight-900">
                    {formData.maxMembers}
                  </span>
                </div>

                <div className="flex justify-between items-center py-3 border-b border-cream-200">
                  <span className="text-midnight-600">Per Cycle</span>
                  <span className="font-semibold text-midnight-900">
                    {formData.contributionAmount || '0'} ALEO
                  </span>
                </div>

                <div className="flex justify-between items-center py-3 border-b border-cream-200">
                  <span className="text-midnight-600">Cycle Duration</span>
                  <span className="font-semibold text-midnight-900">
                    {formData.cycleDuration === '1' ? 'Daily' : 
                     formData.cycleDuration === '7' ? 'Weekly' :
                     formData.cycleDuration === '14' ? 'Bi-weekly' : 'Monthly'}
                  </span>
                </div>

                <div className="flex justify-between items-center py-3 border-b border-cream-200">
                  <span className="text-midnight-600">Total Cycles</span>
                  <span className="font-semibold text-midnight-900">
                    {formData.maxMembers}
                  </span>
                </div>

                <div className="pt-2">
                  <div className="p-4 bg-gradient-to-br from-amber-50 to-amber-100 rounded-xl">
                    <div className="text-sm text-amber-700 mb-1">Pot Size Per Cycle</div>
                    <div className="font-display text-2xl font-bold text-amber-800">
                      {totalPot} ALEO
                    </div>
                  </div>
                </div>
              </div>

              {/* Info note */}
              <div className="mt-6 p-4 bg-forest-50 border border-forest-200 rounded-xl">
                <div className="flex gap-3">
                  <Info className="w-5 h-5 text-forest-600 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-forest-700">
                    As the creator, you'll be the first member. The circle starts 
                    automatically when all {formData.maxMembers} spots are filled.
                  </p>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  )
}
