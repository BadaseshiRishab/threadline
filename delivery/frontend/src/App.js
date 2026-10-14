import { Truck } from 'lucide-react'
import { usePartner } from './context/PartnerContext'
import ApplicationStatusPage from './pages/ApplicationStatusPage'
import DashboardPage from './pages/DashboardPage'
import LoginPage from './pages/LoginPage'

// Signed out: sign in or apply. Applied: the application's status. Approved: the day's deliveries.
function App() {
  const { authReady, partner } = usePartner()
  if (!authReady) return <main className="splash"><Truck size={28} /><span>Loading…</span></main>
  if (!partner) return <LoginPage />
  if (partner.status !== 'approved') return <ApplicationStatusPage />
  return <DashboardPage />
}

export default App
