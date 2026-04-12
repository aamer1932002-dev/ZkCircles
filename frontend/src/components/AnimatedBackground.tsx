import { useEffect, useRef } from 'react'

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

    // ── Concentric ring sets (ROSCA circles) ─────────────────────────
    const ringSets = [
      { cx: 0.78, cy: 0.2, rings: [80, 130, 180], speed: 0.06, angle: 0, color: [251, 191, 36] },
      { cx: 0.18, cy: 0.7, rings: [60, 110, 160], speed: -0.045, angle: 1.5, color: [235, 125, 104] },
      { cx: 0.5, cy: 0.5, rings: [120, 200, 300], speed: 0.025, angle: 0.8, color: [34, 197, 94] },
      { cx: 0.85, cy: 0.75, rings: [50, 90], speed: -0.08, angle: 2, color: [217, 119, 6] },
    ]

    // ── Floating particles ───────────────────────────────────────────
    const colors = [
      [251, 191, 36],  // amber
      [235, 125, 104], // terra
      [34, 197, 94],   // forest
      [217, 119, 6],   // dark amber
    ]

    interface Particle {
      x: number; y: number; r: number
      vx: number; vy: number
      color: number[]; phase: number
    }

    const particleCount = Math.max(12, Math.min(Math.floor(w * h / 60000), 25))
    const particles: Particle[] = Array.from({ length: particleCount }, () => ({
      x: Math.random() * w,
      y: Math.random() * h,
      r: 2.5 + Math.random() * 4,
      vx: (Math.random() - 0.5) * 0.4,
      vy: (Math.random() - 0.5) * 0.35,
      color: colors[Math.floor(Math.random() * colors.length)],
      phase: Math.random() * Math.PI * 2,
    }))

    // ── Rotating member-node groups ──────────────────────────────────
    const memberGroups = [
      { cx: 0.7, cy: 0.35, r: 65, nodes: 5, speed: 0.12, angle: 0, color: [251, 191, 36] },
      { cx: 0.25, cy: 0.55, r: 50, nodes: 4, speed: -0.15, angle: 1, color: [34, 197, 94] },
      { cx: 0.55, cy: 0.85, r: 45, nodes: 3, speed: 0.18, angle: 2, color: [235, 125, 104] },
      { cx: 0.12, cy: 0.2, r: 35, nodes: 6, speed: -0.1, angle: 3, color: [217, 119, 6] },
    ]

    // ── Large ambient glows ──────────────────────────────────────────
    const glows = [
      { cx: 0.15, cy: 0.15, r: 350, color: [251, 191, 36], alpha: 0.06, phase: 0 },
      { cx: 0.85, cy: 0.8, r: 400, color: [34, 197, 94], alpha: 0.05, phase: 1.5 },
      { cx: 0.5, cy: 0.5, r: 500, color: [235, 125, 104], alpha: 0.04, phase: 3 },
    ]

    const connectionDist = 250

    let lastFrame = 0
    const interval = 1000 / 30

    function rgba(c: number[], a: number) {
      return `rgba(${c[0]},${c[1]},${c[2]},${a})`
    }

    function draw(now: number) {
      animId = requestAnimationFrame(draw)
      const delta = now - lastFrame
      if (delta < interval) return
      lastFrame = now - (delta % interval)
      const dt = delta / 1000
      const t = now / 1000

      ctx!.clearRect(0, 0, w, h)

      // ── Ambient glows (pulsing) ────────────────────────────────────
      for (const g of glows) {
        const pulse = g.alpha + Math.sin(t * 0.5 + g.phase) * 0.015
        const grad = ctx!.createRadialGradient(
          g.cx * w, g.cy * h, 0,
          g.cx * w, g.cy * h, g.r
        )
        grad.addColorStop(0, rgba(g.color, pulse))
        grad.addColorStop(0.5, rgba(g.color, pulse * 0.4))
        grad.addColorStop(1, rgba(g.color, 0))
        ctx!.fillStyle = grad
        ctx!.fillRect(0, 0, w, h)
      }

      // ── Concentric ring sets ───────────────────────────────────────
      for (const rs of ringSets) {
        rs.angle += rs.speed * dt
        const cx = rs.cx * w
        const cy = rs.cy * h

        ctx!.save()
        ctx!.translate(cx, cy)
        ctx!.rotate(rs.angle)

        for (let i = 0; i < rs.rings.length; i++) {
          const r = rs.rings[i]
          const alpha = 0.25 - i * 0.06

          // Dashed rings for inner, solid for outer
          ctx!.beginPath()
          ctx!.arc(0, 0, r, 0, Math.PI * 2)
          ctx!.strokeStyle = rgba(rs.color, alpha)
          ctx!.lineWidth = i === 0 ? 1.8 : 1.2
          ctx!.setLineDash(i % 2 === 1 ? [8, 6] : [])
          ctx!.stroke()
        }

        ctx!.restore()
      }

      // ── Member-node groups (rotating polygon) ──────────────────────
      ctx!.setLineDash([])
      for (const mg of memberGroups) {
        mg.angle += mg.speed * dt
        const cx = mg.cx * w
        const cy = mg.cy * h

        // Outer ring
        ctx!.beginPath()
        ctx!.arc(cx, cy, mg.r, 0, Math.PI * 2)
        ctx!.strokeStyle = rgba(mg.color, 0.2)
        ctx!.lineWidth = 1
        ctx!.stroke()

        // Inner dashed ring
        ctx!.beginPath()
        ctx!.arc(cx, cy, mg.r * 0.6, 0, Math.PI * 2)
        ctx!.strokeStyle = rgba(mg.color, 0.12)
        ctx!.lineWidth = 0.8
        ctx!.setLineDash([4, 4])
        ctx!.stroke()
        ctx!.setLineDash([])

        const nodePos: [number, number][] = []
        for (let i = 0; i < mg.nodes; i++) {
          const a = mg.angle + (Math.PI * 2 * i) / mg.nodes
          const nx = cx + Math.cos(a) * mg.r
          const ny = cy + Math.sin(a) * mg.r
          nodePos.push([nx, ny])

          // Node glow
          const grd = ctx!.createRadialGradient(nx, ny, 0, nx, ny, 10)
          grd.addColorStop(0, rgba(mg.color, 0.45))
          grd.addColorStop(1, rgba(mg.color, 0))
          ctx!.fillStyle = grd
          ctx!.beginPath()
          ctx!.arc(nx, ny, 10, 0, Math.PI * 2)
          ctx!.fill()

          // Node dot
          ctx!.beginPath()
          ctx!.arc(nx, ny, 3.5, 0, Math.PI * 2)
          ctx!.fillStyle = rgba(mg.color, 0.6)
          ctx!.fill()
        }

        // Connect nodes with lines
        ctx!.beginPath()
        for (let i = 0; i < nodePos.length; i++) {
          const [x1, y1] = nodePos[i]
          const [x2, y2] = nodePos[(i + 1) % nodePos.length]
          ctx!.moveTo(x1, y1)
          ctx!.lineTo(x2, y2)
        }
        ctx!.strokeStyle = rgba(mg.color, 0.2)
        ctx!.lineWidth = 0.8
        ctx!.stroke()

        // Cross connections (every other node) for star pattern
        if (mg.nodes >= 5) {
          ctx!.beginPath()
          for (let i = 0; i < nodePos.length; i++) {
            const [x1, y1] = nodePos[i]
            const [x2, y2] = nodePos[(i + 2) % nodePos.length]
            ctx!.moveTo(x1, y1)
            ctx!.lineTo(x2, y2)
          }
          ctx!.strokeStyle = rgba(mg.color, 0.08)
          ctx!.lineWidth = 0.5
          ctx!.stroke()
        }
      }

      // ── Particles ──────────────────────────────────────────────────
      for (const p of particles) {
        p.x += p.vx
        p.y += p.vy
        p.phase += 0.015

        if (p.x < -20) p.x = w + 20
        if (p.x > w + 20) p.x = -20
        if (p.y < -20) p.y = h + 20
        if (p.y > h + 20) p.y = -20

        const pulse = 0.4 + Math.sin(p.phase) * 0.15

        // Outer glow
        const grd = ctx!.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 6)
        grd.addColorStop(0, rgba(p.color, pulse * 0.5))
        grd.addColorStop(1, rgba(p.color, 0))
        ctx!.beginPath()
        ctx!.arc(p.x, p.y, p.r * 6, 0, Math.PI * 2)
        ctx!.fillStyle = grd
        ctx!.fill()

        // Core
        ctx!.beginPath()
        ctx!.arc(p.x, p.y, p.r, 0, Math.PI * 2)
        ctx!.fillStyle = rgba(p.color, pulse)
        ctx!.fill()
      }

      // ── Connection arcs between nearby particles ───────────────────
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x
          const dy = particles[i].y - particles[j].y
          const dist = Math.sqrt(dx * dx + dy * dy)
          if (dist < connectionDist) {
            const alpha = (1 - dist / connectionDist) * 0.2
            ctx!.beginPath()
            ctx!.moveTo(particles[i].x, particles[i].y)
            const midX = (particles[i].x + particles[j].x) / 2 + dy * 0.12
            const midY = (particles[i].y + particles[j].y) / 2 - dx * 0.12
            ctx!.quadraticCurveTo(midX, midY, particles[j].x, particles[j].y)
            ctx!.strokeStyle = rgba(particles[i].color, alpha)
            ctx!.lineWidth = 0.8
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
    />
  )
}
