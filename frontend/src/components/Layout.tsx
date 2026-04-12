import { Outlet } from 'react-router-dom'
import Header from './Header'
import Footer from './Footer'
import AnimatedBackground from './AnimatedBackground'

export default function Layout() {
  return (
    <div className="min-h-screen flex flex-col relative">
      <AnimatedBackground />
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
