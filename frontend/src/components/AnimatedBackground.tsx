import { useEffect, useRef } from 'react'

/**
 * Animated canvas background – rotating rings, floating orbs, and
 * connecting arcs that echo the "savings circles" / ROSCA theme.
 *
 * All colours are drawn from the ZkCircles palette:
 *   amber (#FBBF24), terra (#EB7D68), forest (#22C55E), cream (#F9F3E7)
 *
 * Runs at ≤30 fps to stay battery-friendly and uses devicePixelRatio
 * for crisp rendering on retina screens.
 */
export default function AnimatedBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let animId: number
    let w = window.innerWidth
    let h = window.innerHeight
    const dpr = Math.min(window.devicePixelRatio || 1, 2)

    // ── resize handler ───────────────────────────────────────────────
    function resize() {
      w = window.innerWidth
      h = window.innerHeight
      canvas!.width = w * dpr
      canvas!.height = h * dpr
      canvas!.style.width = `${w}px`
      canvas!.style.height = `${h}px`
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    resize()
    window.addEventListener('resize', resize)

    // ── config ───────────────────────────────────────────────────────
    const palette = [
      'rgba(251,191,36,',   // amber-400
      'rgba(235,125,104,',  // terra-400
      'rgba(34,197,94,',    // forest-500
      'rgba(217,119,6,',    // amber-600
      'rgba(196,64,43,',    // terra-600
    ]

    // ── Orbiting rings ───────────────────────────────────────────────
    interface Ring {
      cx: number        // centre X factor (0-1)
      cy: number        // centre Y factor (0-1)
      r: number         // radius
      speed: number     // rad/s
      angle: number
      color: string
      opacity: number
      dash: number[]
      width: number
    }

    const rings: Ring[] = [
      { cx: 0.82, cy: 0.18, r: 160, speed: 0.08, angle: 0, color: palette[0], opacity: 0.18, dash: [], width: 1.2 },
      { cx: 0.15, cy: 0.75, r: 200, speed: -0.06, angle: 1, color: palette[1], opacity: 0.14, dash: [6, 8], width: 1 },
      { cx: 0.55, cy: 0.45, r: 280, speed: 0.04, angle: 2, color: palette[2], opacity: 0.10, dash: [], width: 0.8 },
      { cx: 0.75, cy: 0.70, r: 120, speed: -0.10, angle: 0.5, color: palette[3], opacity: 0.15, dash: [4, 12], width: 1 },
      { cx: 0.30, cy: 0.25, r: 100, speed: 0.12, angle: 3, color: palette[0], opacity: 0.12, dash: [], width: 0.8 },
    ]

    // ── Floating orbs ────────────────────────────────────────────────
    interface Orb {
      x: number
      y: number
      r: number
      vx: number
      vy: number
      color: string
      baseOpacity: number
      phase: number
    }

    const orbCount = Math.min(Math.floor(w / 120), 8)
    const orbs: Orb[] = Array.from({ length: orbCount }, () => ({
      x: Math.random() * w,
      y: Math.random() * h,
      r: 2 + Math.random() * 3,
      vx: (Math.random() - 0.5) * 0.3,
      vy: (Math.random() - 0.5) * 0.25,
      color: palette[Math.floor(Math.random() * palette.length)],
      baseOpacity: 0.25 + Math.random() * 0.25,
      phase: Math.random() * Math.PI * 2,
    }))

    // ── Connection arcs between nearby orbs ───────────────────────────
    const connectionDist = 220

    // ── Rotating polygon nodes (represent "members in a circle") ─────
    interface CircleGroup {
      cx: number
      cy: number
      r: number
      nodes: number
      speed: number
      angle: number
      color: string
      opacity: number
    }

    const circleGroups: CircleGroup[] = [
      { cx: 0.72, cy: 0.32, r: 50, nodes: 5, speed: 0.15, angle: 0, color: palette[0], opacity: 0.22 },
      { cx: 0.22, cy: 0.58, r: 40, nodes: 4, speed: -0.18, angle: 1, color: palette[2], opacity: 0.18 },
      { cx: 0.50, cy: 0.82, r: 35, nodes: 3, speed: 0.20, angle: 2, color: palette[1], opacity: 0.16 },
    ]

    // ── Render loop (throttled ~30fps) ───────────────────────────────
    let lastFrame = 0
    const interval = 1000 / 30

    function draw(now: number) {
      animId = requestAnimationFrame(draw)

      const delta = now - lastFrame
      if (delta < interval) return
      lastFrame = now - (delta % interval)

      const dt = delta / 1000 // seconds

      ctx!.clearRect(0, 0, w, h)

      // — Draw rings ——————————————————————————————————
      for (const ring of rings) {
        ring.angle += ring.speed * dt
        const cx = ring.cx * w
        const cy = ring.cy * h

        ctx!.save()
        ctx!.translate(cx, cy)
        ctx!.rotate(ring.angle)
        ctx!.beginPath()
        ctx!.arc(0, 0, ring.r, 0, Math.PI * 2)
        ctx!.strokeStyle = ring.color + ring.opacity + ')'
        ctx!.lineWidth = ring.width
        if (ring.dash.length) ctx!.setLineDash(ring.dash)
        ctx!.stroke()
        ctx!.restore()
      }

      // — Draw circle-groups (rotating member nodes) ——————————
      for (const cg of circleGroups) {
        cg.angle += cg.speed * dt
        const cx = cg.cx * w
        const cy = cg.cy * h

        // Draw faint outer ring
        ctx!.beginPath()
        ctx!.arc(cx, cy, cg.r, 0, Math.PI * 2)
        ctx!.strokeStyle = cg.color + (cg.opacity * 0.5) + ')'
        ctx!.lineWidth = 0.6
        ctx!.stroke()

        // Draw nodes and connecting lines
        const nodePositions: Array<[number, number]> = []
        for (let i = 0; i < cg.nodes; i++) {
          const a = cg.angle + (Math.PI * 2 * i) / cg.nodes
          const nx = cx + Math.cos(a) * cg.r
          const ny = cy + Math.sin(a) * cg.r
          nodePositions.push([nx, ny])

          // Node dot
          ctx!.beginPath()
          ctx!.arc(nx, ny, 3, 0, Math.PI * 2)
          ctx!.fillStyle = cg.color + cg.opacity + ')'
          ctx!.fill()
        }

        // Connect adjacent nodes
        ctx!.beginPath()
        for (let i = 0; i < nodePositions.length; i++) {
          const [x1, y1] = nodePositions[i]
          const [x2, y2] = nodePositions[(i + 1) % nodePositions.length]
          ctx!.moveTo(x1, y1)
          ctx!.lineTo(x2, y2)
        }
        ctx!.strokeStyle = cg.color + (cg.opacity * 0.6) + ')'
        ctx!.lineWidth = 0.5
        ctx!.setLineDash([])
        ctx!.stroke()
      }

      // — Update & draw orbs ——————————————————————————
      for (const orb of orbs) {
        orb.x += orb.vx
        orb.y += orb.vy
        orb.phase += 0.01

        // Wrap around edges
        if (orb.x < -10) orb.x = w + 10
        if (orb.x > w + 10) orb.x = -10
        if (orb.y < -10) orb.y = h + 10
        if (orb.y > h + 10) orb.y = -10

        const pulseOpacity = orb.baseOpacity + Math.sin(orb.phase) * 0.1

        // Glow
        const gradient = ctx!.createRadialGradient(orb.x, orb.y, 0, orb.x, orb.y, orb.r * 4)
        gradient.addColorStop(0, orb.color + pulseOpacity + ')')
        gradient.addColorStop(1, orb.color + '0)')
        ctx!.beginPath()
        ctx!.arc(orb.x, orb.y, orb.r * 4, 0, Math.PI * 2)
        ctx!.fillStyle = gradient
        ctx!.fill()

        // Core dot
        ctx!.beginPath()
        ctx!.arc(orb.x, orb.y, orb.r, 0, Math.PI * 2)
        ctx!.fillStyle = orb.color + (pulseOpacity + 0.1) + ')'
        ctx!.fill()
      }

      // — Draw connection arcs between close orbs ———————————
      ctx!.setLineDash([])
      for (let i = 0; i < orbs.length; i++) {
        for (let j = i + 1; j < orbs.length; j++) {
          const dx = orbs[i].x - orbs[j].x
          const dy = orbs[i].y - orbs[j].y
          const dist = Math.sqrt(dx * dx + dy * dy)
          if (dist < connectionDist) {
            const alpha = (1 - dist / connectionDist) * 0.12
            ctx!.beginPath()
            ctx!.moveTo(orbs[i].x, orbs[i].y)
            // Slight curve for organic feel
            const midX = (orbs[i].x + orbs[j].x) / 2 + (dy * 0.15)
            const midY = (orbs[i].y + orbs[j].y) / 2 - (dx * 0.15)
            ctx!.quadraticCurveTo(midX, midY, orbs[j].x, orbs[j].y)
            ctx!.strokeStyle = `rgba(251,191,36,${alpha})`
            ctx!.lineWidth = 0.6
            ctx!.stroke()
          }
        }
      }
    }

    animId = requestAnimationFrame(draw)

    return () => {
      cancelAnimationFrame(animId)
      window.removeEventListener('resize', resize)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 z-[0] pointer-events-none"
      aria-hidden="true"
      style={{ opacity: 0.85 }}
    />
  )
}
