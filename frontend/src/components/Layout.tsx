import { Outlet } from 'react-router-dom'
import Header from './Header'
import Footer from './Footer'

/* ── Animated floating rings that echo the "circles" / ROSCA theme ───────── */
function AnimatedBackground() {
  return (
    // z-[0]: no longer negative — negative z-index fixed elements go behind the
    // root background paint layer in all browsers and are never visible.
    <div className="fixed inset-0 z-[0] overflow-hidden pointer-events-none" aria-hidden>
      {/* Slow orbiting ring – top-right */}
      <div className="absolute -top-24 -right-24 w-[420px] h-[420px] rounded-full border-2 border-amber-300/60 animate-orbit" />
      {/* Second ring – bottom-left, counter-clockwise */}
      <div className="absolute -bottom-32 -left-32 w-[520px] h-[520px] rounded-full border-2 border-amber-400/50 animate-orbit-reverse" />
      {/* Small accent ring – mid left */}
      <div className="absolute top-1/3 -left-16 w-[220px] h-[220px] rounded-full border-2 border-dashed border-terra-400/45 animate-spin-slow" />
      {/* Glowing blob – top-left amber */}
      <div className="absolute -top-40 -left-40 w-[500px] h-[500px] rounded-full bg-amber-300/45 blur-2xl animate-pulse-soft" />
      {/* Glowing blob – bottom-right forest */}
      <div className="absolute -bottom-48 -right-48 w-[600px] h-[600px] rounded-full bg-forest-300/35 blur-2xl animate-pulse-soft-delayed" />
      {/* Glowing blob – centre-right */}
      <div className="absolute top-1/2 -right-32 w-[360px] h-[360px] rounded-full bg-amber-200/30 blur-2xl animate-pulse-soft" />
      {/* Tiny floating dots – scattered */}
      <div className="absolute top-[18%] left-[72%] w-3 h-3 rounded-full bg-amber-500/70 animate-float" />
      <div className="absolute top-[55%] left-[12%] w-2.5 h-2.5 rounded-full bg-terra-500/60 animate-float-delayed" />
      <div className="absolute top-[78%] left-[82%] w-3.5 h-3.5 rounded-full bg-forest-500/55 animate-float" />
      <div className="absolute top-[35%] left-[45%] w-2.5 h-2.5 rounded-full bg-amber-500/55 animate-float-delayed" />
    </div>
  )
}

export default function Layout() {
  return (
    // outer div has no explicit bg so the fixed z-0 background is visible
    <div className="min-h-screen flex flex-col">
      <AnimatedBackground />
      {/* z-[1] so all page content sits above the z-0 animated background */}
      <div className="relative z-[1] flex flex-col flex-1">
        <Header />
        <main className="flex-1">
          <Outlet />
        </main>
        <Footer />
      </div>
    </div>
  )
}
