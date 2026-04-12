import { useEffect, useRef, useState } from 'react'
import { motion, useInView } from 'framer-motion'

interface AnimatedCounterProps {
  value: number
  duration?: number
  suffix?: string
  prefix?: string
  decimals?: number
  className?: string
}

export default function AnimatedCounter({
  value,
  duration = 1.5,
  suffix = '',
  prefix = '',
  decimals = 0,
  className = '',
}: AnimatedCounterProps) {
  const ref = useRef<HTMLSpanElement>(null)
  const isInView = useInView(ref, { once: true, margin: '-50px' })
  const [displayValue, setDisplayValue] = useState(0)

  useEffect(() => {
    if (!isInView) return

    const startTime = Date.now()
    const startValue = 0

    const animate = () => {
      const elapsed = Date.now() - startTime
      const progress = Math.min(elapsed / (duration * 1000), 1)
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3)
      const current = startValue + (value - startValue) * eased

      setDisplayValue(current)

      if (progress < 1) {
        requestAnimationFrame(animate)
      }
    }

    requestAnimationFrame(animate)
  }, [isInView, value, duration])

  return (
    <motion.span
      ref={ref}
      className={className}
      initial={{ opacity: 0, scale: 0.5 }}
      animate={isInView ? { opacity: 1, scale: 1 } : {}}
      transition={{ duration: 0.4, ease: 'easeOut' }}
    >
      {prefix}{decimals > 0 ? displayValue.toFixed(decimals) : Math.round(displayValue)}{suffix}
    </motion.span>
  )
}
