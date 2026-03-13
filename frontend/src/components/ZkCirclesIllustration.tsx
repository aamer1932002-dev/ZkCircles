import { motion } from 'framer-motion'
import { useEffect, useState } from 'react'

// ─── Member positions on a ring ───────────────────────────────────────────────
const MEMBER_ANGLES = [0, 60, 120, 180, 240, 300]
const RING_R   = 130   // px from center to member
const CX       = 200   // SVG viewBox center
const CY       = 200

function memberPos(deg: number) {
  const rad = (deg - 90) * (Math.PI / 180)
  return {
    x: CX + RING_R * Math.cos(rad),
    y: CY + RING_R * Math.sin(rad),
  }
}

// ─── Floating badge pills data ─────────────────────────────────────────────────
const BADGES = [
  { label: 'Zero-Knowledge Proofs', color: 'bg-amber-100 text-amber-800 border-amber-200',   top: '-3%',  left: '-8%',  delay: 0    },
  { label: 'Private ROSCA',          color: 'bg-forest-100 text-forest-800 border-forest-200', top: '8%',   right: '-6%', delay: 0.6  },
  { label: 'Aleo Testnet',           color: 'bg-terra-100 text-terra-800 border-terra-200',    bottom: '12%', left: '-10%', delay: 1.1 },
  { label: 'BHP256 Privacy',         color: 'bg-midnight-100 text-midnight-700 border-midnight-200', bottom: '2%', right: '-4%', delay: 1.7 },
]

// ─── Stats strip ───────────────────────────────────────────────────────────────
const STATS = [
  { value: 'v11', label: 'Contract' },
  { value: '17',  label: 'Transitions' },
  { value: '10',  label: 'Mappings' },
  { value: '0',   label: 'Plain Addrs' },
]

// ─── Per-member stagger animation (pulse + scale) ─────────────────────────────
const memberVariants = {
  idle: (i: number) => ({
    scale: [1, 1.12, 1],
    transition: { duration: 2.2, repeat: Infinity, delay: i * 0.38, ease: 'easeInOut' },
  }),
}

export default function ZkCirclesIllustration() {
  // Cycle through which member is "receiving" the payout
  const [activeIdx, setActiveIdx] = useState(0)

  useEffect(() => {
    const id = setInterval(() => setActiveIdx(i => (i + 1) % MEMBER_ANGLES.length), 2800)
    return () => clearInterval(id)
  }, [])

  return (
    <div className="relative w-[430px] h-[500px] mx-auto select-none">

      {/* ── Floating badge pills ─────────────────────────────────── */}
      {BADGES.map((b, i) => (
        <motion.div
          key={b.label}
          className={`absolute z-20 flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-semibold shadow-sm whitespace-nowrap ${b.color}`}
          style={{
            top:    b.top,
            left:   b.left,
            right:  b.right,
            bottom: b.bottom,
          }}
          initial={{ opacity: 0, y: 8 }}
          animate={{
            opacity: 1,
            y: [0, -7, 0],
          }}
          transition={{
            opacity: { duration: 0.5, delay: b.delay },
            y: { duration: 3.5 + i * 0.4, repeat: Infinity, ease: 'easeInOut', delay: b.delay },
          }}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-current opacity-60" />
          {b.label}
        </motion.div>
      ))}

      {/* ── Main SVG illustration ────────────────────────────────── */}
      <div className="absolute inset-0 top-6 flex items-center justify-center">
        <svg
          viewBox="0 0 400 400"
          width="400"
          height="400"
          className="overflow-visible"
        >
          <defs>
            {/* Amber gradient for fund-flow paths */}
            <linearGradient id="flowGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%"   stopColor="#F59E0B" stopOpacity="0.15" />
              <stop offset="50%"  stopColor="#F59E0B" stopOpacity="0.55" />
              <stop offset="100%" stopColor="#F59E0B" stopOpacity="0.15" />
            </linearGradient>

            {/* Payout glow gradient */}
            <radialGradient id="payoutGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%"   stopColor="#F59E0B" stopOpacity="0.35" />
              <stop offset="100%" stopColor="#F59E0B" stopOpacity="0" />
            </radialGradient>

            {/* Central glow */}
            <radialGradient id="centerGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%"   stopColor="#FCD34D" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#F59E0B" stopOpacity="0" />
            </radialGradient>
          </defs>

          {/* ── Outer ambient glow ── */}
          <circle cx={CX} cy={CY} r="185" fill="url(#centerGlow)" />

          {/* ── Outer decorative rings ── */}
          <motion.circle
            cx={CX} cy={CY} r="170"
            fill="none"
            stroke="#F59E0B"
            strokeOpacity="0.18"
            strokeWidth="1.5"
            strokeDasharray="6 10"
            animate={{ rotate: 360 }}
            transition={{ duration: 40, repeat: Infinity, ease: 'linear' }}
            style={{ transformOrigin: `${CX}px ${CY}px` }}
          />
          <motion.circle
            cx={CX} cy={CY} r="148"
            fill="none"
            stroke="#F59E0B"
            strokeOpacity="0.12"
            strokeWidth="1"
            strokeDasharray="3 14"
            animate={{ rotate: -360 }}
            transition={{ duration: 55, repeat: Infinity, ease: 'linear' }}
            style={{ transformOrigin: `${CX}px ${CY}px` }}
          />

          {/* ── Contribution lines (member → center) ── */}
          {MEMBER_ANGLES.map((deg, i) => {
            const { x, y } = memberPos(deg)
            const isActive = i === activeIdx
            // Quadratic bezier curve bowing outward slightly
            const mx = (x + CX) / 2 + (CY - y) * 0.15
            const my = (y + CY) / 2 + (x - CX) * 0.15
            const pathLen = Math.hypot(x - CX, y - CY) * 1.05

            return (
              <g key={`line-${deg}`}>
                {/* Static faint track */}
                <path
                  d={`M ${x} ${y} Q ${mx} ${my} ${CX} ${CY}`}
                  fill="none"
                  stroke="#F59E0B"
                  strokeOpacity={isActive ? 0.4 : 0.15}
                  strokeWidth={isActive ? 1.5 : 1}
                  strokeDasharray="4 6"
                />

                {/* Animated dash traveling along the path */}
                <motion.path
                  d={`M ${x} ${y} Q ${mx} ${my} ${CX} ${CY}`}
                  fill="none"
                  stroke="#F59E0B"
                  strokeOpacity={isActive ? 0.9 : 0.4}
                  strokeWidth={isActive ? 2.5 : 1.5}
                  strokeLinecap="round"
                  strokeDasharray="12 200"
                  animate={{ strokeDashoffset: [0, -pathLen] }}
                  transition={{
                    duration: 1.8,
                    repeat: Infinity,
                    ease: 'linear',
                    delay: i * 0.3,
                  }}
                />
              </g>
            )
          })}

          {/* ── Payout glow behind active member ── */}
          {(() => {
            const { x, y } = memberPos(MEMBER_ANGLES[activeIdx])
            return (
              <motion.circle
                key={`glow-${activeIdx}`}
                cx={x} cy={y} r="38"
                fill="url(#payoutGlow)"
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: [1, 1.4, 1], opacity: [0.6, 1, 0.6] }}
                transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                style={{ transformOrigin: `${x}px ${y}px` }}
              />
            )
          })()}

          {/* ── Payout arc (center → active member) ── */}
          {(() => {
            const { x, y } = memberPos(MEMBER_ANGLES[activeIdx])
            const mx = (x + CX) / 2 - (CY - y) * 0.25
            const my = (y + CY) / 2 - (x - CX) * 0.25
            const arcLen = Math.hypot(x - CX, y - CY) * 1.08
            return (
              <motion.path
                key={`payout-${activeIdx}`}
                d={`M ${CX} ${CY} Q ${mx} ${my} ${x} ${y}`}
                fill="none"
                stroke="#F59E0B"
                strokeWidth="3"
                strokeLinecap="round"
                strokeDasharray="18 200"
                animate={{ strokeDashoffset: [0, -arcLen] }}
                transition={{ duration: 1.2, repeat: Infinity, ease: 'linear' }}
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
              />
            )
          })()}

          {/* ── Member nodes ── */}
          {MEMBER_ANGLES.map((deg, i) => {
            const { x, y } = memberPos(deg)
            const isActive = i === activeIdx
            return (
              <motion.g
                key={`member-${deg}`}
                custom={i}
                animate="idle"
                variants={memberVariants}
                style={{ transformOrigin: `${x}px ${y}px` }}
              >
                {/* Outer ring on active */}
                {isActive && (
                  <motion.circle
                    cx={x} cy={y} r="24"
                    fill="none"
                    stroke="#F59E0B"
                    strokeWidth="2"
                    strokeOpacity="0.7"
                    strokeDasharray="4 4"
                    animate={{ rotate: 360 }}
                    transition={{ duration: 4, repeat: Infinity, ease: 'linear' }}
                    style={{ transformOrigin: `${x}px ${y}px` }}
                  />
                )}

                {/* Member circle */}
                <circle
                  cx={x} cy={y} r="18"
                  fill={isActive ? '#F59E0B' : '#6B7280'}
                  opacity={isActive ? 1 : 0.75}
                />

                {/* Icon placeholder — simple person silhouette path */}
                <text
                  x={x} y={y + 1}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontSize="11"
                  fontWeight="bold"
                  fill="white"
                  opacity="0.9"
                >
                  {isActive ? '↓' : 'M'}
                </text>

                {/* Active label */}
                {isActive && (
                  <motion.g
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3 }}
                  >
                    <rect
                      x={x - 28} y={y - 36}
                      width="56" height="18"
                      rx="9"
                      fill="#F59E0B"
                    />
                    <text
                      x={x} y={y - 26}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fontSize="8.5"
                      fontWeight="bold"
                      fill="white"
                    >
                      Payout ✓
                    </text>
                  </motion.g>
                )}
              </motion.g>
            )
          })}

          {/* ── Central pot ── */}
          <motion.g
            animate={{ scale: [1, 1.06, 1] }}
            transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
            style={{ transformOrigin: `${CX}px ${CY}px` }}
          >
            {/* Shadow ring */}
            <circle cx={CX} cy={CY} r="42" fill="#FCD34D" opacity="0.25" />
            {/* Main circle */}
            <circle
              cx={CX} cy={CY} r="34"
              fill="url(#flowGrad)"
              stroke="#F59E0B"
              strokeWidth="2.5"
              opacity="1"
              style={{ fill: '#F59E0B' }}
            />
            {/* Lock icon — simplified SVG */}
            <rect x={CX - 9} y={CY - 3} width="18" height="13" rx="3" fill="white" opacity="0.95" />
            <path
              d={`M ${CX - 6} ${CY - 3} a6 6 0 0 1 12 0`}
              fill="none"
              stroke="white"
              strokeWidth="3"
              strokeLinecap="round"
            />
            <circle cx={CX} cy={CY + 4} r="2.5" fill="#F59E0B" />
          </motion.g>

          {/* ── "Cycle N" badge near center ── */}
          <motion.g
            animate={{ opacity: [0.7, 1, 0.7] }}
            transition={{ duration: 2.5, repeat: Infinity }}
          >
            <rect x={CX - 22} y={CY + 40} width="44" height="16" rx="8" fill="#FEF3C7" />
            <text
              x={CX} y={CY + 49}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize="8"
              fontWeight="700"
              fill="#92400E"
            >
              cycle {activeIdx + 1}/6
            </text>
          </motion.g>
        </svg>
      </div>

      {/* ── Stats strip ─────────────────────────────────────────── */}
      <div className="absolute bottom-0 left-0 right-0 flex justify-center gap-3">
        {STATS.map((s, i) => (
          <motion.div
            key={s.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 + i * 0.12 }}
            className="flex flex-col items-center bg-white/70 backdrop-blur-sm border border-amber-100 rounded-xl px-3 py-2 shadow-sm"
          >
            <span className="font-display font-bold text-lg text-amber-600 leading-none">
              {s.value}
            </span>
            <span className="text-[10px] text-midnight-500 mt-0.5 font-medium uppercase tracking-wide">
              {s.label}
            </span>
          </motion.div>
        ))}
      </div>
    </div>
  )
}
