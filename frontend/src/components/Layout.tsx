import { Outlet } from 'react-router-dom'
import Header from './Header'
import Footer from './Footer'

/* ── Animated floating rings that echo the "circles" / ROSCA theme ───────── */
function AnimatedBackground() {
  return (
    <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none" aria-hidden>
      {/* Slow orbiting ring – top-right */}
      <div className="absolute -top-24 -right-24 w-[420px] h-[420px] rounded-full border border-amber-300/20 animate-orbit" />
      {/* Second ring – bottom-left, counter-clockwise */}
      <div className="absolute -bottom-32 -left-32 w-[520px] h-[520px] rounded-full border border-amber-400/15 animate-orbit-reverse" />
      {/* Small accent ring – mid left */}
      <div className="absolute top-1/3 -left-16 w-[220px] h-[220px] rounded-full border-2 border-dashed border-terra-300/15 animate-spin-slow" />
      {/* Glowing blob – top-left */}
      <div className="absolute -top-40 -left-40 w-[500px] h-[500px] rounded-full bg-amber-400/[0.04] blur-3xl animate-pulse-soft" />
      {/* Glowing blob – bottom-right */}
      <div className="absolute -bottom-48 -right-48 w-[600px] h-[600px] rounded-full bg-forest-400/[0.04] blur-3xl animate-pulse-soft-delayed" />
      {/* Tiny floating dots – scattered */}
      <div className="absolute top-[18%] left-[72%] w-2 h-2 rounded-full bg-amber-400/30 animate-float" />
      <div className="absolute top-[55%] left-[12%] w-1.5 h-1.5 rounded-full bg-terra-400/25 animate-float-delayed" />
      <div className="absolute top-[78%] left-[82%] w-2.5 h-2.5 rounded-full bg-forest-400/20 animate-float" />
      <div className="absolute top-[35%] left-[45%] w-1.5 h-1.5 rounded-full bg-amber-500/20 animate-float-delayed" />
    </div>
  )
}

export default function Layout() {
  return (
    <div className="min-h-screen flex flex-col relative">
      <AnimatedBackground />
      <Header />
      <main className="flex-1">
        <Outlet />
      </main>
      <Footer />
    </div>
  )
}
