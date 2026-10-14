import { createContext, useContext, useEffect, useState } from 'react'
import * as sellerApi from '../api/seller'
import { initialProfile } from '../utils/constants'
import { normalizeProduct } from '../utils/product'

const SellerContext = createContext(null)

export function useSeller() {
  const seller = useContext(SellerContext)
  if (!seller) throw new Error('useSeller must be used inside <SellerProvider>')
  return seller
}

const emptyIdentity = { id: '', email: '', phone: '' }
// Where a signed-in seller lands, from the state of their application.
const phaseFor = (user) => user.sellerStatus === 'approved' ? 'dashboard' : user.sellerStatus === 'pending' ? 'pending' : 'onboarding'

export function SellerProvider({ children }) {
  // 'register' | 'login' | 'onboarding' | 'pending' | 'dashboard'
  const [phase, setPhase] = useState('register')
  const [authReady, setAuthReady] = useState(false)
  const [identity, setIdentity] = useState(emptyIdentity)
  const [phoneOtpEnabled, setPhoneOtpEnabled] = useState(false)
  const [profile, setProfile] = useState(initialProfile)
  const [products, setProducts] = useState([])
  const [orders, setOrders] = useState([])
  const [restockRequests, setRestockRequests] = useState([])
  // A message from the last request (an error, or a confirmation), shown on the current page.
  const [backendNotice, setBackendNotice] = useState('')

  useEffect(() => {
    let active = true
    void sellerApi.fetchVerificationConfig()
      .then((config) => {
        if (!active) return
        setPhoneOtpEnabled(config.phoneOtpEnabled)
      })
      .catch(() => undefined)
    const restoreSession = async () => {
      try {
        const user = await sellerApi.fetchCurrentUser()
        if (user.role !== 'seller') return
        const [application, sellerProducts] = await Promise.all([sellerApi.fetchApplication(), sellerApi.fetchProducts()])
        if (!active) return
        setIdentity({ id: user.id, email: user.email, phone: user.phone })
        setProfile({ ...initialProfile, ...application })
        setProducts(sellerProducts.map(normalizeProduct))
        setPhase(phaseFor(user))
      } catch {
        if (active) setPhase('register')
      } finally {
        if (active) setAuthReady(true)
      }
    }
    void restoreSession()
    return () => { active = false }
  }, [])

  // After signing in: loads the seller's application and products and opens the right page.
  const startSession = async (user) => {
    const [application, sellerProducts] = await Promise.all([sellerApi.fetchApplication(), sellerApi.fetchProducts()])
    setIdentity({ id: user.id, email: user.email, phone: user.phone })
    setProfile({ ...initialProfile, ...application, primaryEmail: String(application.primaryEmail || user.email), primaryPhone: String(application.primaryPhone || user.phone) })
    setProducts(sellerProducts.map(normalizeProduct))
    setPhase(phaseFor(user))
  }

  const signOut = async () => {
    await sellerApi.logout().catch(() => undefined)
    setIdentity(emptyIdentity)
    setProducts([])
    setProfile(initialProfile)
    setAuthReady(true)
    setPhase('register')
  }

  const value = {
    phase, setPhase, authReady, identity, phoneOtpEnabled, startSession, signOut,
    profile, setProfile, products, setProducts, orders, setOrders, restockRequests, setRestockRequests,
    backendNotice, setBackendNotice,
  }
  return <SellerContext.Provider value={value}>{children}</SellerContext.Provider>
}
