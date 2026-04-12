import { motion } from 'framer-motion'
import { ReactNode } from 'react'

const pageVariants = {
  initial: {
    opacity: 0,
    y: 12,
    filter: 'blur(4px)',
  },
  enter: {
    opacity: 1,
    y: 0,
    filter: 'blur(0px)',
    transition: {
      duration: 0.4,
      ease: [0.25, 0.4, 0.25, 1],
      staggerChildren: 0.08,
    },
  },
  exit: {
    opacity: 0,
    y: -8,
    filter: 'blur(4px)',
    transition: {
      duration: 0.25,
      ease: [0.4, 0, 1, 1],
    },
  },
}

interface PageTransitionProps {
  children: ReactNode
  className?: string
}

export default function PageTransition({ children, className = '' }: PageTransitionProps) {
  return (
    <motion.div
      variants={pageVariants}
      initial="initial"
      animate="enter"
      exit="exit"
      className={className}
    >
      {children}
    </motion.div>
  )
}

// Stagger item — wrap individual cards/sections within a PageTransition
export const staggerItem = {
  initial: { opacity: 0, y: 16 },
  enter: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.35, ease: [0.25, 0.4, 0.25, 1] },
  },
}
