import { Routes, Route, useLocation } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { AnimatePresence } from 'framer-motion'

// Layout
import Layout from './components/Layout'

// Pages
import Home from './pages/Home'
import CreateCircle from './pages/CreateCircle'
import JoinCircle from './pages/JoinCircle'
import MyCircles from './pages/MyCircles'
import CircleDetail from './pages/CircleDetail'
import Explorer from './pages/Explorer'
import HowItWorks from './pages/HowItWorks'
import Privacy from './pages/Privacy'
import Analytics from './pages/Analytics'
import CycleDashboard from './pages/CycleDashboard'
import InviteAccept from './pages/InviteAccept'
import DisputeResolution from './pages/DisputeResolution'

function App() {
  const location = useLocation()

  return (
    <>
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: {
            background: '#FEFDFB',
            color: '#2C241F',
            border: '1px solid #F3E8D4',
            borderRadius: '1rem',
            boxShadow: '0 10px 15px -3px rgba(146, 64, 14, 0.1)',
          },
          success: {
            iconTheme: {
              primary: '#16A34A',
              secondary: '#FFFFFF',
            },
          },
          error: {
            iconTheme: {
              primary: '#D95D44',
              secondary: '#FFFFFF',
            },
          },
        }}
      />
      <AnimatePresence mode="wait">
        <Routes location={location} key={location.pathname}>
          <Route path="/" element={<Layout />}>
          <Route index element={<Home />} />
          <Route path="create" element={<CreateCircle />} />
          <Route path="join" element={<JoinCircle />} />
          <Route path="join/:circleId" element={<JoinCircle />} />
          <Route path="my-circles" element={<MyCircles />} />
          <Route path="circle/:circleId" element={<CircleDetail />} />
          <Route path="analytics/:circleId" element={<Analytics />} />
          <Route path="analytics" element={<Analytics />} />
          <Route path="dashboard/:circleId" element={<CycleDashboard />} />
          <Route path="invite/:code" element={<InviteAccept />} />
          <Route path="disputes/:circleId" element={<DisputeResolution />} />
          <Route path="explorer" element={<Explorer />} />
          <Route path="how-it-works" element={<HowItWorks />} />
          <Route path="privacy" element={<Privacy />} />
        </Route>
      </Routes>
      </AnimatePresence>
    </>
  )
}

export default App
