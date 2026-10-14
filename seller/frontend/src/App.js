import { useSeller } from './context/SellerContext'
import AuthPage from './pages/AuthPage'
import DashboardPage from './pages/DashboardPage'
import OnboardingPage from './pages/OnboardingPage'
import PendingPage from './pages/PendingPage'

// Shows the page for where the seller is: signing in, applying, waiting for approval, or selling.
function App() {
  const { phase, authReady } = useSeller()
  if (!authReady) return <main className="auth-loading"><span className="wordmark-mark">t.</span><p>Connecting to Threadline...</p></main>
  if (phase === 'register' || phase === 'login') return <AuthPage />
  if (phase === 'onboarding') return <OnboardingPage />
  if (phase === 'pending') return <PendingPage />
  return <DashboardPage />
}

export default App
