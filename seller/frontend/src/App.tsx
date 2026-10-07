import { useEffect, useRef, useState, type ChangeEvent, type FormEvent, type InputHTMLAttributes, type SelectHTMLAttributes } from 'react'
import {
  ArrowDownRight,
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  Boxes,
  Check,
  ChevronDown,
  CircleHelp,
  Clock3,
  FileCheck2,
  ImagePlus,
  LayoutDashboard,
  LogOut,
  PackageCheck,
  PackagePlus,
  Plus,
  RotateCcw,
  Search,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Store,
  Upload,
  Wallet,
} from 'lucide-react'
import { api } from './api'
import './App.css'

const ADMIN_PORTAL_URL = process.env.ADMIN_PORTAL_URL || 'http://localhost:5174'

type Phase = 'register' | 'login' | 'onboarding' | 'pending' | 'dashboard'
type SellerIdentity = { id: string; email: string; phone: string }
type Product = {
  id: string
  name: string
  tagline: string
  category: string
  subcategory: string
  cost: number
  sellingPrice?: number | null
  description: string
  imageUrl: string
  stock: Record<string, number>
  status: 'pending' | 'approved' | 'rejected'
}
type ProductRecord = Omit<Product, 'id'> & { id?: string; _id?: string }
type ReturnRequest = { status: 'requested' | 'approved' | 'rejected'; reason: string; message: string; sellerMessage?: string; requestedAt: string; resolvedAt?: string; restockedQuantity?: number }
// An accepted return comes back with a delivery partner; the return code to give them arrives by SMS.
type ReturnPickup = { status: 'awaiting_partner' | 'assigned' | 'picked_up' | 'returned'; codeSent?: boolean; partner: { name: string; phone: string; vehicleNumber?: string } | null; assignedAt?: string; pickedUpAt?: string; returnedAt?: string }
type SellerOrderItem = { _id: string; product?: string; name: string; imageUrl?: string; size?: string; quantity: number; unitPrice?: number; returnRequest?: ReturnRequest; returnPickup?: ReturnPickup | null }
const paymentMethodLabels: Record<string, string> = { cod: 'Cash on delivery', razorpay: 'Razorpay', upi: 'UPI', phonepe: 'PhonePe UPI' }
const paymentStatusLabels: Record<string, string> = { pending: 'to collect', awaiting_verification: 'verifying', paid: 'paid', failed: 'failed' }
const paymentLabel = (order: { paymentMethod?: string; paymentStatus?: string }) => `${paymentMethodLabels[order.paymentMethod || 'cod'] || order.paymentMethod} · ${paymentStatusLabels[order.paymentStatus || 'pending'] || order.paymentStatus}`
// With a delivery partner assigned the seller only packs; the partner records pickup and delivery.
const partnerHandling = (order: { status: string; deliveryPartner?: unknown }) => Boolean(order.deliveryPartner) && !['placed', 'packed'].includes(order.status)
const awaitingUpi = (order: { paymentMethod?: string; paymentStatus?: string }) => order.paymentMethod === 'upi' && order.paymentStatus !== 'paid'
type SellerOrder = { _id: string; customerId: string; status: string; paymentMethod?: string; paymentStatus?: string; deliveryPartner?: { name: string; phone: string; vehicleNumber?: string } | null; pickup?: { codeSent?: boolean; pickedUpAt?: string } | null; createdAt: string; deliveredAt?: string; items: SellerOrderItem[] }
type RestockRequest = { _id: string; status: 'open' | 'fulfilled'; createdAt: string; fulfilledAt?: string; requestedStock?: Record<string, number>; addedStock?: Record<string, number>; product: { _id: string; name: string; imageUrl?: string; stock: Record<string, number> } }
type ProductDraft = Omit<Product, 'id' | 'status' | 'cost' | 'stock'> & {
  cost: string
  stock: Record<string, string>
}
type SellerProfile = Record<string, string | boolean>

const initialProfile: SellerProfile = {
  gstin: '',
  businessName: '',
  primaryName: '',
  primaryEmail: '',
  primaryPhone: '',
  sameOwner: true,
  ownerName: '',
  ownerEmail: '',
  ownerPhone: '',
  sellerAddress: '',
  sellerCity: '',
  sellerState: '',
  sellerPincode: '',
  sameWarehouse: true,
  warehouseAddress: '',
  warehouseCity: '',
  warehouseState: '',
  warehousePincode: '',
  signature: '',
  bankName: '',
  accountType: '',
  ifsc: '',
  accountNumber: '',
  accountHolder: '',
  sellingMode: 'marketplace',
  marketplaceName: '',
  marketplaceRating: '',
  websiteUrl: '',
}

const emptyProduct: ProductDraft = {
  name: '',
  tagline: '',
  category: 'Women',
  subcategory: 'Dresses',
  cost: '',
  description: '',
  imageUrl: '',
  stock: {},
}

const normalizeProduct = (product: ProductRecord): Product => ({
  ...product,
  id: product.id || product._id || '',
})

function TextField({ label, ...props }: InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <label className="field">
      <span>{label}</span>
      <input className="control" {...props} />
    </label>
  )
}

function SelectField({ label, children, ...props }: SelectHTMLAttributes<HTMLSelectElement> & { label: string }) {
  return (
    <label className="field">
      <span>{label}</span>
      <span className="select-wrap">
        <select className="control" {...props}>{children}</select>
        <ChevronDown size={15} aria-hidden="true" />
      </span>
    </label>
  )
}

function App() {
  const [phase, setPhase] = useState<Phase>('register')
  const [authReady, setAuthReady] = useState(false)
  const [identity, setIdentity] = useState<SellerIdentity>({ id: '', email: '', phone: '' })
  const [authEmail, setAuthEmail] = useState('')
  const [authPhone, setAuthPhone] = useState('')
  const [authPassword, setAuthPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [authError, setAuthError] = useState('')
  const [phoneOtpEnabled, setPhoneOtpEnabled] = useState(false)
  // Only the mobile number is verified with a code; the email address is just entered.
  const [verification, setVerification] = useState({ phone: false })
  const [verificationSent, setVerificationSent] = useState({ phone: false })
  const [verificationCodes, setVerificationCodes] = useState({ phone: '' })
  const [verificationMessage, setVerificationMessage] = useState('')
  const [approvalMessage, setApprovalMessage] = useState('')
  const [profile, setProfile] = useState<SellerProfile>(initialProfile)
  const [onboardingStep, setOnboardingStep] = useState(0)
  const [products, setProducts] = useState<Product[]>([])
  const [productDraft, setProductDraft] = useState<ProductDraft>(emptyProduct)
  const [dashboardTab, setDashboardTab] = useState<'overview' | 'products' | 'orders' | 'returns' | 'restock' | 'add-product'>('overview')
  const [orders, setOrders] = useState<SellerOrder[]>([])
  const [returnReplies, setReturnReplies] = useState<Record<string, string>>({})
  const [returnBusy, setReturnBusy] = useState('')
  // Orders the seller is marking delivered, with the OTP typed so far.
  const [deliveryOtps, setDeliveryOtps] = useState<Record<string, string>>({})
  const [restockRequests, setRestockRequests] = useState<RestockRequest[]>([])
  const [restockDrafts, setRestockDrafts] = useState<Record<string, Record<string, string>>>({})
  const [dashboardDate] = useState(() => new Intl.DateTimeFormat('en-IN', { weekday: 'long', month: 'long', day: '2-digit', year: 'numeric' }).format(new Date()).toUpperCase())
  const [searchTerm, setSearchTerm] = useState('')
  const [signatureFile, setSignatureFile] = useState<File | null>(null)
  const [backendNotice, setBackendNotice] = useState('')
  const stepPanelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let active = true
    void api<{ phoneOtpEnabled: boolean }>('/auth/verification/config')
      .then((config) => {
        if (!active) return
        setPhoneOtpEnabled(config.phoneOtpEnabled)
      })
      .catch(() => undefined)
    const restoreSession = async () => {
      try {
        const { user } = await api<{ user: { id: string; role: string; email: string; phone: string; sellerStatus: string } }>('/auth/me')
        if (user.role !== 'seller') return
        const [{ application }, { products: sellerProducts }] = await Promise.all([
          api<{ application: SellerProfile }>('/seller/application'),
          api<{ products: ProductRecord[] }>('/seller/products'),
        ])
        if (!active) return
        setIdentity({ id: user.id, email: user.email, phone: user.phone })
        setAuthEmail(user.email)
        setAuthPhone(user.phone)
        setProfile({ ...initialProfile, ...application })
        setProducts(sellerProducts.map(normalizeProduct))
        setPhase(user.sellerStatus === 'approved' ? 'dashboard' : user.sellerStatus === 'pending' ? 'pending' : 'onboarding')
      } catch {
        if (active) setPhase('register')
      } finally {
        if (active) setAuthReady(true)
      }
    }
    void restoreSession()
    return () => { active = false }
  }, [])

  useEffect(() => {
    if (phase !== 'onboarding' || !authReady) return
    const timeout = window.setTimeout(() => {
      void api('/seller/application', { method: 'PUT', body: profile })
        .then(() => setBackendNotice(''))
        .catch((error: Error) => setBackendNotice(error.message))
    }, 500)
    return () => window.clearTimeout(timeout)
  }, [phase, profile, authReady])

  useEffect(() => {
    if (phase !== 'dashboard' || !authReady) return
    let active = true
    const refreshProducts = async () => {
      try {
        const [{ products: sellerProducts }, { requests }] = await Promise.all([
          api<{ products: ProductRecord[] }>('/seller/products'),
          api<{ requests: RestockRequest[] }>('/seller/restock-requests'),
        ])
        if (!active) return
        setProducts(sellerProducts.map(normalizeProduct))
        setRestockRequests(requests)
      } catch {
        return
      }
    }
    void refreshProducts()
    const refreshInterval = window.setInterval(() => void refreshProducts(), 20_000)
    return () => {
      active = false
      window.clearInterval(refreshInterval)
    }
  }, [phase, authReady])

  useEffect(() => {
    if (phase !== 'dashboard' || !authReady) return
    void api<{ orders: SellerOrder[] }>('/seller/orders').then(({ orders: nextOrders }) => setOrders(nextOrders)).catch(() => undefined)
  }, [phase, authReady, dashboardTab === 'orders' || dashboardTab === 'returns'])

  const goTo = (next: Phase) => {
    setPhase(next)
  }

  const updateProfile = (event: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const target = event.currentTarget
    const rawValue = target instanceof HTMLInputElement && target.type === 'checkbox' ? target.checked : target.value
    const value = typeof rawValue === 'string' && ['gstin', 'ifsc'].includes(target.name) ? rawValue.toUpperCase() : rawValue
    setProfile((current) => ({ ...current, [target.name]: value }))
  }

  const profileField = (name: string, label: string, type = 'text', placeholder = '', extra: InputHTMLAttributes<HTMLInputElement> = {}) => (
    <TextField
      label={label}
      name={name}
      type={type}
      placeholder={placeholder}
      value={String(profile[name] ?? '')}
      onChange={updateProfile}
      required
      {...extra}
    />
  )

  const profileSelect = (name: string, label: string, options: string[]) => (
    <SelectField label={label} name={name} value={String(profile[name] ?? '')} onChange={updateProfile} required>
      <option value="" disabled>Select {label.toLowerCase()}</option>
      {options.map((option) => <option key={option}>{option}</option>)}
    </SelectField>
  )

  const completeRegistration = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (phoneOtpEnabled && !verification.phone) {
      setAuthError('Verify your phone number to continue.')
      return
    }
    if (authPassword !== confirmPassword) {
      setAuthError('Your passwords do not match.')
      return
    }
    try {
      await api('/auth/register', { method: 'POST', body: { email: authEmail.trim().toLowerCase(), phone: authPhone, password: authPassword, confirmPassword } })
      setAuthEmail(authEmail.trim().toLowerCase())
      setAuthError('')
      setAuthPassword('')
      setConfirmPassword('')
      setPhase('login')
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : 'Could not create your account.')
    }
  }

  const completeLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    try {
      const { user } = await api<{ user: { id: string; email: string; phone: string; role: string; sellerStatus: string } }>('/auth/login', { method: 'POST', body: { email: authEmail, password: authPassword } })
      if (user.role !== 'seller') {
        await api('/auth/logout', { method: 'POST' })
        setAuthError('This account does not have seller access.')
        return
      }
      const [{ application }, { products: sellerProducts }] = await Promise.all([
        api<{ application: SellerProfile }>('/seller/application'),
        api<{ products: ProductRecord[] }>('/seller/products'),
      ])
      const nextProfile = { ...initialProfile, ...application, primaryEmail: String(application.primaryEmail || user.email), primaryPhone: String(application.primaryPhone || user.phone) }
      setIdentity({ id: user.id, email: user.email, phone: user.phone })
      setProfile(nextProfile)
      setProducts(sellerProducts.map(normalizeProduct))
      setAuthError('')
      setAuthPassword('')
      setOnboardingStep(0)
      setPhase(user.sellerStatus === 'approved' ? 'dashboard' : user.sellerStatus === 'pending' ? 'pending' : 'onboarding')
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : 'Sign-in failed.')
    }
  }

  const sendVerification = async () => {
    if (!/^[6-9]\d{9}$/.test(authPhone)) {
      setVerificationMessage('Enter a valid 10-digit Indian mobile number first.')
      return
    }
    try {
      const result = await api<{ message: string }>('/auth/verification/send', { method: 'POST', body: { channel: 'phone', address: authPhone } })
      setVerificationSent({ phone: true })
      setVerification({ phone: false })
      setVerificationMessage(result.message)
      setAuthError('')
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : 'Could not send a verification code.')
    }
  }

  const confirmVerification = async () => {
    try {
      const result = await api<{ message: string }>('/auth/verification/confirm', { method: 'POST', body: { channel: 'phone', address: authPhone, code: verificationCodes.phone } })
      setVerification({ phone: true })
      setVerificationMessage(result.message)
      setAuthError('')
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : 'Could not verify that code.')
    }
  }

  const verifyPhone = () => {
    if (!/^[6-9]\d{9}$/.test(authPhone)) {
      setVerificationMessage('Enter a valid 10-digit Indian mobile number first.')
      return
    }
    void sendVerification()
  }

  const uploadSignature = async (file: File) => {
    setSignatureFile(file)
    const form = new FormData()
    form.append('signature', file)
    try {
      const result = await api<{ signature: string }>('/seller/application/signature', { method: 'POST', body: form })
      setProfile((current) => ({ ...current, signature: result.signature }))
      setBackendNotice('')
    } catch (error) {
      setBackendNotice(error instanceof Error ? error.message : 'Could not upload the signature image.')
    }
  }

  const advanceOnboarding = async () => {
    const invalid = stepPanelRef.current?.querySelector<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(':invalid')
    if (invalid) {
      invalid.reportValidity()
      return
    }
    try {
      await api('/seller/application', { method: 'PUT', body: profile })
      if (onboardingStep < 3) {
        setOnboardingStep((current) => current + 1)
        return
      }
      await api('/seller/application/submit', { method: 'POST', body: {} })
      setBackendNotice('')
      goTo('pending')
    } catch (error) {
      setBackendNotice(error instanceof Error ? error.message : 'Could not save your application.')
    }
  }

  const checkSellerApproval = async () => {
    try {
      const { user } = await api<{ user: { sellerStatus: string } }>('/auth/me')
      if (user.sellerStatus === 'approved') {
        goTo('dashboard')
        setDashboardTab('overview')
        setApprovalMessage('')
        const { products: sellerProducts } = await api<{ products: ProductRecord[] }>('/seller/products')
        setProducts(sellerProducts.map(normalizeProduct))
        return
      }
      setApprovalMessage(user.sellerStatus === 'rejected' ? 'Your application needs updates. Contact seller support for details.' : 'Your application is still under review. Check back after the admin has made a decision.')
    } catch (error) {
      setApprovalMessage(error instanceof Error ? error.message : 'Could not check your approval status.')
    }
  }

  const updateProduct = (name: keyof ProductDraft, value: string) => {
    setProductDraft((current) => ({ ...current, [name]: value }))
  }

  const submitProduct = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    try {
      const { product } = await api<{ product: ProductRecord }>('/seller/products', {
        method: 'POST',
        body: {
          ...productDraft,
          cost: Number(productDraft.cost),
          stock: Object.fromEntries(Object.entries(productDraft.stock).map(([size, count]) => [size, Number(count || 0)])),
        },
      })
      setProducts((current) => [normalizeProduct(product), ...current])
      setProductDraft(emptyProduct)
      setDashboardTab('overview')
    } catch (error) {
      setBackendNotice(error instanceof Error ? error.message : 'Could not submit this product.')
    }
  }

  // The inputs start at the quantities admin asked for; the seller can change them before adding.
  const restockValue = (entry: RestockRequest, size: string) => restockDrafts[entry._id]?.[size] ?? (entry.requestedStock?.[size] ? String(entry.requestedStock[size]) : '')
  const addRestockStock = async (requestId: string) => {
    const entry = restockRequests.find((candidate) => candidate._id === requestId)
    const sizes = new Set([...Object.keys(entry?.product.stock ?? {}), ...Object.keys(entry?.requestedStock ?? {})])
    const stock = Object.fromEntries([...sizes].map((size) => [size, Number(entry ? restockValue(entry, size) || 0 : 0)]).filter(([, count]) => Number(count) > 0))
    try {
      const { request: fulfilled, product } = await api<{ request: RestockRequest; product: ProductRecord }>(`/seller/restock-requests/${requestId}/fulfill`, { method: 'POST', body: { stock } })
      setRestockRequests((current) => current.map((entry) => entry._id === requestId ? { ...entry, status: 'fulfilled', fulfilledAt: fulfilled.fulfilledAt, addedStock: fulfilled.addedStock, product: { ...entry.product, stock: product.stock } } : entry))
      setProducts((current) => current.map((entry) => entry.id === (product.id ?? product._id) ? { ...entry, stock: product.stock } : entry))
      setRestockDrafts((current) => { const next = { ...current }; delete next[requestId]; return next })
      setBackendNotice('Stock added. It is now live on the store.')
    } catch (error) {
      setBackendNotice(error instanceof Error ? error.message : 'Could not add stock.')
    }
  }

  const updateOrderStatus = async (orderId: string, status: string, otp?: string) => {
    try {
      const { order } = await api<{ order: SellerOrder }>(`/seller/orders/${orderId}/status`, { method: 'PATCH', body: { status, otp } })
      setOrders((current) => current.map((item) => item._id === orderId ? order : item))
      setDeliveryOtps((current) => { const next = { ...current }; delete next[orderId]; return next })
      setBackendNotice(status === 'delivered' ? 'OTP verified. Order marked as delivered.' : 'Order status updated.')
    } catch (error) {
      setBackendNotice(error instanceof Error ? error.message : 'Could not update order status.')
    }
  }

  // One entry per order item the customer asked to return, newest request first.
  const returnRequests = orders.flatMap((order) => order.items.filter((item) => item.returnRequest).map((item) => ({ order, item, request: item.returnRequest! }))).sort((a, b) => b.request.requestedAt.localeCompare(a.request.requestedAt))
  const openReturns = returnRequests.filter((entry) => entry.request.status === 'requested')
  // Pickup and return codes are only ever sent by SMS; this asks the API to text one again.
  const [resending, setResending] = useState('')
  const resendCode = async (key: string, path: string) => {
    setResending(key)
    try {
      const { message } = await api<{ message: string }>(path, { method: 'POST' })
      setBackendNotice(message)
    } catch (error) {
      setBackendNotice(error instanceof Error ? error.message : 'Could not send the code. Try again.')
    } finally {
      setResending('')
    }
  }
  // Returns a partner has collected and is bringing back now: the seller gives them the code on receiving the items.
  const incomingReturns = returnRequests.filter((entry) => entry.item.returnPickup?.status === 'picked_up')
  const returnPickupLabels: Record<ReturnPickup['status'], string> = { awaiting_partner: 'Waiting for a delivery partner', assigned: 'Partner collecting from customer', picked_up: 'On its way back to you', returned: 'Returned to you' }
  const decideReturn = async (order: SellerOrder, item: SellerOrderItem, decision: 'approved' | 'rejected') => {
    const message = (returnReplies[item._id] ?? '').trim()
    if (decision === 'rejected' && message.length < 10) { setBackendNotice('Tell the customer why you are rejecting the return (at least 10 characters).'); return }
    setReturnBusy(item._id)
    try {
      const { order: updated, restockedQuantity } = await api<{ order: SellerOrder; restockedQuantity: number }>(`/seller/orders/${order._id}/items/${item._id}/return`, { method: 'POST', body: { decision, message } })
      setOrders((current) => current.map((entry) => entry._id === updated._id ? updated : entry))
      setReturnReplies((current) => { const next = { ...current }; delete next[item._id]; return next })
      if (restockedQuantity && item.product) setProducts((current) => current.map((product) => product.id === item.product && item.size ? { ...product, stock: { ...product.stock, [item.size]: Number(product.stock[item.size] || 0) + restockedQuantity } } : product))
      setBackendNotice(decision === 'approved' ? 'Return accepted. A delivery partner will collect the item from the customer and bring it back to you; it goes back into stock when it arrives.' : 'Return rejected. The customer can see your message.')
    } catch (error) {
      setBackendNotice(error instanceof Error ? error.message : 'Could not update the return request.')
    } finally {
      setReturnBusy('')
    }
  }

  const signOut = async () => {
    await api('/auth/logout', { method: 'POST' }).catch(() => undefined)
    setIdentity({ id: '', email: '', phone: '' })
    setProducts([])
    setProfile(initialProfile)
    setAuthReady(true)
    setPhase('register')
  }

  if (!authReady) return <main className="auth-loading"><span className="wordmark-mark">t.</span><p>Connecting to Threadline...</p></main>

  if (phase === 'register' || phase === 'login') {
    const isRegistering = phase === 'register'
    return (
      <main className="auth-shell">
        <section className="auth-visual">
          <div className="auth-visual-image" />
          <a className="wordmark wordmark-light" href="#top" aria-label="Threadline home"><span className="wordmark-mark">t.</span> threadline</a>
          <div className="visual-copy">
            <span className="eyebrow light-eyebrow"><Sparkles size={14} /> THE SELLER COLLECTIVE</span>
            <h1>Make room<br />for your <em>kind</em><br />of style.</h1>
            <p>Bring your label to a marketplace made for the next generation of fashion.</p>
          </div>
          <div className="visual-footer"><span>01 / SELLER STUDIO</span><span>INDIA&nbsp; · &nbsp;EST. 2025</span></div>
          <div className="image-note">A new point of view<br /><span>starts with you.</span></div>
        </section>

        <section className="auth-main" id="top">
          <header className="auth-topbar">
            <span className="secure-note"><ShieldCheck size={15} /> SELLER ACCOUNT</span>
            <button className="help-link" type="button" title="Contact seller support"><CircleHelp size={16} /><span>Need help?</span></button>
          </header>
          <div className="auth-card">
            <div className="auth-step-label"><span className="step-dot">0{isRegistering ? '1' : '2'}</span><span>{isRegistering ? 'CREATE YOUR ACCOUNT' : 'WELCOME BACK'}</span></div>
            <h2>{isRegistering ? 'Start selling with us.' : 'Good to have you back.'}</h2>
            <p className="auth-intro">{isRegistering ? 'A few details to get your seller account started.' : 'Sign in to continue setting up your store.'}</p>

            <form className="auth-form" onSubmit={isRegistering ? completeRegistration : completeLogin}>
              {isRegistering && <>
                {phoneOtpEnabled ? <>
                  <div className="verify-field">
                    <TextField label="Mobile number" type="tel" autoComplete="tel-national" placeholder="98765 43210" value={authPhone} onChange={(event) => { setAuthPhone(event.target.value.replace(/\D/g, '').slice(0, 10)); setVerification({ phone: false }); setVerificationSent({ phone: false }) }} pattern="[6-9][0-9]{9}" title="Enter a valid 10-digit Indian mobile number" required />
                    <button className={`verify-button ${verification.phone ? 'is-verified' : ''}`} type="button" onClick={verifyPhone}>{verification.phone ? <><Check size={14} /> Verified</> : verificationSent.phone ? 'Resend code' : 'Send code'}</button>
                  </div>
                  {verificationSent.phone && !verification.phone && <div className="verification-code-row"><TextField label="Phone verification code" inputMode="numeric" autoComplete="one-time-code" placeholder="6-digit code" value={verificationCodes.phone} onChange={(event) => setVerificationCodes((current) => ({ ...current, phone: event.target.value.replace(/\D/g, '').slice(0, 6) }))} pattern="[0-9]{6}" maxLength={6} required /><button className="verify-button" type="button" onClick={() => void confirmVerification()}>Confirm</button></div>}
                </> : <>
                  <TextField label="Mobile number" type="tel" autoComplete="tel-national" placeholder="98765 43210" value={authPhone} onChange={(event) => { setAuthPhone(event.target.value.replace(/\D/g, '').slice(0, 10)); setVerification({ phone: false }) }} pattern="[6-9][0-9]{9}" title="Enter a valid 10-digit Indian mobile number" required />
                  <p className="inline-feedback">SMS verification is disabled in development; we’ll validate the number format.</p>
                </>}
                <TextField label="Email address" type="email" autoComplete="email" placeholder="you@yourlabel.com" value={authEmail} onChange={(event) => setAuthEmail(event.target.value)} required />
                <TextField label="Create password" type="password" autoComplete="new-password" placeholder="At least 10 characters" value={authPassword} onChange={(event) => setAuthPassword(event.target.value)} minLength={10} required />
                <TextField label="Confirm password" type="password" autoComplete="new-password" placeholder="Enter your password again" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} minLength={10} required />
                {verificationMessage && <p className="inline-feedback" aria-live="polite">{verificationMessage}</p>}
              </>}
              {!isRegistering && <>
                <TextField label="Email address" type="email" autoComplete="email" placeholder="you@yourlabel.com" value={authEmail} onChange={(event) => setAuthEmail(event.target.value)} required />
                <TextField label="Password" type="password" autoComplete="current-password" placeholder="Your password" value={authPassword} onChange={(event) => setAuthPassword(event.target.value)} required />
              </>}
              {authError && <p className="form-error" role="alert">{authError}</p>}
              <button className="button button-primary auth-submit" type="submit">{isRegistering ? 'Create seller account' : 'Sign in'}<ArrowRight size={17} /></button>
            </form>

            <div className="auth-switch">
              <span>{isRegistering ? 'Already registered?' : 'New to Threadline?'}</span>
              <button type="button" onClick={() => { setAuthError(''); setPhase(isRegistering ? 'login' : 'register') }}>{isRegistering ? 'Sign in' : 'Create an account'}</button>
            </div>
            <p className="auth-disclaimer">By continuing, you agree to our seller terms and privacy policy.</p>
            {authError && <p className="form-error auth-bottom-error" role="alert">{authError}</p>}
          </div>
          <footer className="auth-bottom"><span>© 2025 THREADLINE COMMERCE</span><span>MADE FOR INDEPENDENT LABELS</span><a className="auth-admin-link" href={ADMIN_PORTAL_URL}>Admin portal</a></footer>
        </section>
      </main>
    )
  }

  if (phase === 'onboarding') {
    const steps = ['Business', 'People & address', 'Bank details', 'Selling online']
    const field = (name: string, label: string, type = 'text', placeholder = '', extra: InputHTMLAttributes<HTMLInputElement> = {}) => profileField(name, label, type, placeholder, extra)
    return (
      <main className="onboarding-shell">
        <header className="onboarding-header">
          <a className="wordmark" href="#top"><span className="wordmark-mark">t.</span> threadline</a>
          <div className="onboarding-header-right"><span><ShieldCheck size={15} /> ENCRYPTED APPLICATION</span><button className="text-button" type="button" onClick={signOut}><LogOut size={15} /> Sign out</button></div>
        </header>
        <div className="onboarding-layout">
          <aside className="onboarding-aside">
            <span className="eyebrow">SELLER APPLICATION&nbsp; / &nbsp;01</span>
            <h1>Let’s get to<br />know your <em>label.</em></h1>
            <p>Tell us a little about your business. This information helps us set up your seller account and verify your store.</p>
            <div className="step-list">
              {steps.map((item, index) => <div className={`step-list-item ${index === onboardingStep ? 'active' : ''} ${index < onboardingStep ? 'complete' : ''}`} key={item}><span className="step-list-number">{index < onboardingStep ? <Check size={14} /> : `0${index + 1}`}</span><span>{item}</span><span className="step-list-state">{index < onboardingStep ? 'DONE' : index === onboardingStep ? 'IN PROGRESS' : ''}</span></div>)}
            </div>
            <div className="aside-help"><CircleHelp size={17} /><span>Questions about seller setup?<br /><a href="mailto:sellers@threadline.example">Talk to seller support</a></span></div>
          </aside>

          <section className="onboarding-content" id="top">
            <div className="onboarding-progress"><span>APPLICATION PROGRESS</span><strong>{Math.round(((onboardingStep + 1) / steps.length) * 100)}%</strong><div className="progress-track"><span style={{ width: `${((onboardingStep + 1) / steps.length) * 100}%` }} /></div></div>
            <div className="form-heading"><span className="eyebrow">STEP 0{onboardingStep + 1} OF 04</span><h2>{['Business details', 'People & addresses', 'Bank details', 'Where you sell'][onboardingStep]}</h2><p>{['Start with your registered business identity.', 'Add the people and places connected to your store.', 'Add the account where your payouts should land.', 'Tell us how customers find your products today.'][onboardingStep]}</p></div>

            <div className="form-panel" ref={stepPanelRef}>
              {onboardingStep === 0 && <div className="field-grid">
                <div className="field-grid-full">{field('gstin', 'GSTIN', 'text', '22AAAAA0000A1Z5', { pattern: '[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]', title: 'Enter a valid 15-character GSTIN', maxLength: 15, style: { textTransform: 'uppercase' } })}</div>
                <div className="field-grid-full">{field('businessName', 'Registered business name', 'text', 'As shown on your GST certificate')}</div>
                <div className="field-grid-full"><div className="section-divider"><span>PRIMARY CONTACT</span><span>Who we’ll reach out to</span></div></div>
                {field('primaryName', 'Full name', 'text', 'Contact person')}
                {field('primaryEmail', 'Email address', 'email', 'name@business.com')}
                {field('primaryPhone', 'Phone number', 'tel', '10-digit mobile number', { pattern: '[6-9][0-9]{9}' })}
              </div>}

              {onboardingStep === 1 && <div className="field-grid">
                <div className="field-grid-full"><label className="check-row"><input name="sameOwner" type="checkbox" checked={Boolean(profile.sameOwner)} onChange={updateProfile} /><span className="custom-check"><Check size={13} /></span><span><strong>Business owner is the primary contact</strong><small>Use the contact details already provided</small></span></label></div>
                {!profile.sameOwner && <>
                  <div className="field-grid-full"><div className="section-divider"><span>BUSINESS OWNER</span><span>Legal account holder</span></div></div>
                  {field('ownerName', 'Owner full name', 'text', 'Name as shown on ID')}
                  {field('ownerEmail', 'Owner email', 'email', 'owner@business.com')}
                  {field('ownerPhone', 'Owner phone number', 'tel', '10-digit mobile number', { pattern: '[6-9][0-9]{9}' })}
                </>}
                <div className="field-grid-full"><div className="section-divider"><span>SELLER ADDRESS</span><span>Registered business address</span></div></div>
                <label className="field field-grid-full"><span>Street address</span><textarea className="control textarea" name="sellerAddress" value={String(profile.sellerAddress)} onChange={updateProfile} placeholder="Building, street, area" required /></label>
                {field('sellerCity', 'City', 'text', 'City')}{field('sellerState', 'State', 'text', 'State')}{field('sellerPincode', 'PIN code', 'text', '6-digit PIN', { pattern: '[0-9]{6}', maxLength: 6 })}
                <div className="field-grid-full"><div className="section-divider"><span>WAREHOUSE ADDRESS</span><span>Where your inventory ships from</span></div></div>
                <div className="field-grid-full"><label className="check-row"><input name="sameWarehouse" type="checkbox" checked={Boolean(profile.sameWarehouse)} onChange={updateProfile} /><span className="custom-check"><Check size={13} /></span><span><strong>Same as seller address</strong><small>Use your registered address as the dispatch location</small></span></label></div>
                {!profile.sameWarehouse && <>
                  <label className="field field-grid-full"><span>Warehouse street address</span><textarea className="control textarea" name="warehouseAddress" value={String(profile.warehouseAddress)} onChange={updateProfile} placeholder="Building, street, area" required /></label>
                  {field('warehouseCity', 'City', 'text', 'City')}{field('warehouseState', 'State', 'text', 'State')}{field('warehousePincode', 'PIN code', 'text', '6-digit PIN', { pattern: '[0-9]{6}', maxLength: 6 })}
                </>}
                <div className="field-grid-full"><div className="section-divider"><span>BUSINESS OWNER SIGNATURE</span><span>PNG or JPEG · up to 5 MB</span></div><label className={`upload-field ${profile.signature ? 'has-file' : ''}`}><input type="file" accept="image/png,image/jpeg" required={!profile.signature} onChange={(event) => { const file = event.currentTarget.files?.[0]; if (file) void uploadSignature(file) }} /><span className="upload-icon"><Upload size={18} /></span><span><strong>{signatureFile?.name || (profile.signature ? 'Signature uploaded' : 'Upload signature image')}</strong><small>{profile.signature ? 'Click to replace this file' : 'A clear image of the business owner’s signature'}</small></span><ArrowDownRight size={16} /></label></div>
              </div>}

              {onboardingStep === 2 && <div className="field-grid">
                <div className="field-grid-full"><div className="bank-note"><Wallet size={19} /><span><strong>Your payouts, your account.</strong><small>Bank details are used only for seller settlements.</small></span><ShieldCheck size={17} /></div></div>
                <div className="field-grid-full">{field('bankName', 'Bank name', 'text', 'e.g. HDFC Bank')}</div>
                {profileSelect('accountType', 'Account type', ['Current', 'Savings'])}
                {field('ifsc', 'IFSC code', 'text', 'e.g. HDFC0001234', { pattern: '[A-Z]{4}0[A-Z0-9]{6}', title: 'Enter a valid 11-character IFSC code', maxLength: 11, style: { textTransform: 'uppercase' } })}
                {field('accountNumber', 'Account number', 'text', 'Enter account number', { minLength: 8, maxLength: 18, pattern: '[0-9]{8,18}' })}
                {field('accountHolder', 'Account holder name', 'text', 'As registered with your bank')}
              </div>}

              {onboardingStep === 3 && <div className="field-grid">
                <div className="field-grid-full"><span className="field-label">How do you currently sell?</span><div className="choice-grid">
                  <label className={`choice-card ${profile.sellingMode === 'marketplace' ? 'selected' : ''}`}><input type="radio" name="sellingMode" value="marketplace" checked={profile.sellingMode === 'marketplace'} onChange={updateProfile} required /><span className="choice-icon"><ShoppingBag size={19} /></span><strong>On a marketplace</strong><small>I sell through another shopping platform</small></label>
                  <label className={`choice-card ${profile.sellingMode === 'independent' ? 'selected' : ''}`}><input type="radio" name="sellingMode" value="independent" checked={profile.sellingMode === 'independent'} onChange={updateProfile} required /><span className="choice-icon"><Store size={19} /></span><strong>Independently</strong><small>I sell through my own website</small></label>
                </div></div>
                {profile.sellingMode === 'marketplace' ? <>
                  {field('marketplaceName', 'Marketplace name', 'text', 'e.g. Amazon, Ajio')}
                  {field('marketplaceRating', 'Current seller rating', 'number', 'e.g. 4.5', { min: 0, max: 5, step: 0.1 })}
                </> : <div className="field-grid-full">{field('websiteUrl', 'Website URL', 'url', 'https://yourbrand.com')}</div>}
                <div className="field-grid-full"><div className="review-summary"><FileCheck2 size={19} /><span><strong>Ready for a final review?</strong><small>Our team usually reviews complete applications within 2–3 business days.</small></span></div></div>
              </div>}
            </div>

            <div className="form-actions">
              {onboardingStep > 0 ? <button className="button button-quiet" type="button" onClick={() => setOnboardingStep((current) => current - 1)}><ArrowLeft size={16} /> Back</button> : <span className="save-note"><ShieldCheck size={14} /> Your progress saves automatically</span>}
              <button className="button button-primary" type="button" onClick={advanceOnboarding}>{onboardingStep === 3 ? 'Submit application' : 'Save & continue'}<ArrowRight size={16} /></button>
            </div>
            {backendNotice && <p className="backend-notice" role="alert">{backendNotice}</p>}
            <p className="prototype-note">Your seller information is saved securely to your account as you continue.</p>
          </section>
        </div>
      </main>
    )
  }

  if (phase === 'pending') {
    return (
      <main className="pending-shell">
        <header className="pending-header"><a className="wordmark" href="#top"><span className="wordmark-mark">t.</span> threadline</a><span className="application-id">APPLICATION&nbsp; / &nbsp;{identity.id.slice(-8).toUpperCase()}</span></header>
        <section className="pending-content" id="top">
          <div className="pending-illustration"><div className="orbit orbit-one" /><div className="orbit orbit-two" /><div className="orbit-center"><Clock3 size={31} strokeWidth={1.5} /></div><span className="orbit-dot dot-one" /><span className="orbit-dot dot-two" /><span className="orbit-dot dot-three" /></div>
          <span className="eyebrow">APPLICATION RECEIVED</span>
          <h1>Good things<br />take <em>a moment.</em></h1>
          <p className="pending-copy">Your seller application is with our team. We’ll send an update to <strong>{identity.email || 'your registered email'}</strong> as soon as the review is complete.</p>
          <div className="review-timeline"><div className="timeline-item complete"><span><Check size={13} /></span><div><strong>Application submitted</strong><small>All your details are safely with us</small></div><time>NOW</time></div><div className="timeline-item current"><span><Clock3 size={13} /></span><div><strong>Seller verification</strong><small>Usually completed in 2–3 business days</small></div><time>IN REVIEW</time></div><div className="timeline-item"><span><LayoutDashboard size={13} /></span><div><strong>Your seller dashboard</strong><small>Products and store tools unlock after approval</small></div></div></div>
          <button className="button button-primary pending-back" type="button" onClick={() => void checkSellerApproval()}>Check approval status<ArrowRight size={16} /></button>
          {approvalMessage && <p className="approval-feedback" role="status">{approvalMessage}</p>}
            <p className="prototype-note pending-prototype">Admin decisions appear here once your application has been reviewed.</p>
        </section>
        <footer className="pending-footer"><span>THREADLINE SELLER STUDIO</span><a href="mailto:sellers@threadline.example">Questions? Contact seller support</a></footer>
      </main>
    )
  }

  const approvedProducts = products.filter((product) => product.status === 'approved')
  const pendingProducts = products.filter((product) => product.status === 'pending')
  const matchingProducts = approvedProducts.filter((product) => `${product.name} ${product.category} ${product.subcategory}`.toLowerCase().includes(searchTerm.toLowerCase()))
  const categories: Record<string, string[]> = {
    Women: ['Dresses', 'Tops', 'Kurtas', 'Jeans'],
    Men: ['Shirts', 'T-shirts', 'Jeans', 'Kurtas'],
    Footwear: ['Sneakers', 'Sandals', 'Heels', 'Flats'],
    Accessories: ['Bags', 'Belts', 'Jewellery', 'Scarves'],
  }
  const sizeOptions = productDraft.category === 'Footwear' || ['Sneakers', 'Sandals', 'Heels', 'Flats'].includes(productDraft.subcategory)
    ? ['36', '37', '38', '39', '40', '41', '42']
    : productDraft.category === 'Accessories' || ['Bags', 'Belts', 'Jewellery', 'Scarves'].includes(productDraft.subcategory)
      ? ['One size']
      : ['XS', 'S', 'M', 'L', 'XL', 'XXL']

  return (
    <main className="dashboard-shell">
      <aside className="dashboard-sidebar">
        <a className="wordmark wordmark-light dashboard-brand" href="#top"><span className="wordmark-mark">t.</span> threadline</a>
        <div className="store-switcher"><span className="store-avatar"><Store size={17} /></span><span><strong>{String(profile.businessName || 'Your label')}</strong><small>SELLER ACCOUNT</small></span><ChevronDown size={15} /></div>
        <span className="sidebar-label">WORKSPACE</span>
        <nav className="sidebar-nav" aria-label="Seller dashboard">
          <button className={dashboardTab === 'overview' ? 'active' : ''} type="button" onClick={() => setDashboardTab('overview')}><LayoutDashboard size={17} /> Overview</button>
          <button className={dashboardTab === 'products' ? 'active' : ''} type="button" onClick={() => setDashboardTab('products')}><Boxes size={17} /> Products <span className="nav-count">{approvedProducts.length}</span></button>
          <button className={dashboardTab === 'orders' ? 'active' : ''} type="button" onClick={() => setDashboardTab('orders')}><PackageCheck size={17} /> Orders <span className="nav-count">{orders.length}</span></button>
          <button className={dashboardTab === 'returns' ? 'active' : ''} type="button" onClick={() => setDashboardTab('returns')}><RotateCcw size={17} /> Returns <span className="nav-count">{openReturns.length}</span></button>
          <button className={dashboardTab === 'restock' ? 'active' : ''} type="button" onClick={() => setDashboardTab('restock')}><Boxes size={17} /> Restock requests <span className="nav-count">{restockRequests.filter((entry) => entry.status === 'open').length}</span></button>
        </nav>
        <div className="sidebar-bottom"><div className="seller-avatar">{(identity.email || 'S').slice(0, 1).toUpperCase()}</div><span><strong>{identity.email || 'Seller account'}</strong><small>Approved seller</small></span><button type="button" onClick={signOut} aria-label="Sign out"><LogOut size={16} /></button></div>
      </aside>

      <section className="dashboard-main" id="top">
        <header className="dashboard-topbar"><div className="breadcrumb">SELLER STUDIO <span>/</span> {dashboardTab === 'products' ? 'PRODUCTS' : dashboardTab === 'orders' ? 'ORDERS' : dashboardTab === 'returns' ? 'RETURNS' : dashboardTab === 'restock' ? 'RESTOCK REQUESTS' : dashboardTab === 'add-product' ? 'ADD PRODUCT' : 'OVERVIEW'}</div><div className="topbar-actions"><label className="search-box"><Search size={16} /><input aria-label="Search products" placeholder="Search products" value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} /></label><button className="help-icon" type="button" title="Seller support"><CircleHelp size={17} /></button><div className="topbar-initial">{(identity.email || 'S').slice(0, 1).toUpperCase()}</div></div></header>

        {dashboardTab === 'overview' && <div className="dashboard-page">
          <div className="dashboard-heading"><div><span className="eyebrow">{dashboardDate}</span><h1>Good morning, {String(profile.primaryName || 'seller').split(' ')[0]}.</h1><p>Your store is ready for its next good thing.</p></div><button className="button button-primary" type="button" onClick={() => setDashboardTab('add-product')}><Plus size={17} /> Add a product</button></div>
          <div className="welcome-banner"><div className="welcome-copy"><span className="welcome-kicker"><BadgeCheck size={15} /> SELLER ACCOUNT ACTIVE</span><h2>Your label has a new home.</h2><p>Start with your first product and build a storefront that feels like you.</p><button type="button" onClick={() => setDashboardTab('add-product')}>Add your first product <ArrowRight size={15} /></button></div><div className="banner-image" role="img" aria-label="Fashion collection on a clothing rack" /></div>
          <div className="metric-grid"><div className="metric-card"><span>LIVE PRODUCTS <Boxes size={17} /></span><strong>{approvedProducts.length.toString().padStart(2, '0')}</strong><small>Approved and on your store</small></div><div className="metric-card"><span>UNDER REVIEW <Clock3 size={17} /></span><strong>{pendingProducts.length.toString().padStart(2, '0')}</strong><small>Awaiting product approval</small></div><div className="metric-card"><span>TOTAL STOCK <PackageCheck size={17} /></span><strong>{approvedProducts.reduce((sum, product) => sum + Object.values(product.stock).reduce((total, count) => total + count, 0), 0)}</strong><small>Units across live products</small></div><div className="metric-card metric-accent"><span>SELLER STATUS <ShieldCheck size={17} /></span><strong>Active</strong><small>Your seller profile is approved</small></div></div>

          <div className="dashboard-section-heading"><div><span className="eyebrow">NEXT UP</span><h2>Make your store yours.</h2></div><span className="section-caption">A LITTLE AT A TIME</span></div>
          <div className="action-grid"><button className="action-tile" type="button" onClick={() => setDashboardTab('add-product')}><span className="action-icon action-coral"><PackagePlus size={19} /></span><span><strong>Add a product</strong><small>Bring your collection to life</small></span><ArrowRight size={16} /></button><button className="action-tile" type="button" onClick={() => setDashboardTab('products')}><span className="action-icon action-green"><Boxes size={19} /></span><span><strong>Manage products</strong><small>Review your approved catalog</small></span><ArrowRight size={16} /></button><div className="action-tile action-static"><span className="action-icon action-yellow"><Wallet size={19} /></span><span><strong>Bank details added</strong><small>Seller settlements are set up</small></span><Check size={16} /></div></div>

          {backendNotice && <p className="backend-notice" role="alert">{backendNotice}</p>}
          {pendingProducts.length > 0 && <section className="review-queue"><div className="dashboard-section-heading"><div><span className="eyebrow">AWAITING ADMIN REVIEW</span><h2>Product submissions</h2></div><span className="review-chip"><Clock3 size={13} /> {pendingProducts.length} awaiting review</span></div><div className="queue-list">{pendingProducts.map((product) => <div className="queue-item" key={product.id}><span className="queue-image" style={{ backgroundImage: `url(${product.imageUrl})` }} /><span className="queue-product"><strong>{product.name}</strong><small>{product.id} · {product.category} / {product.subcategory}</small></span><span className="status-pill pending-pill">In review</span></div>)}</div></section>}
          <div className="dashboard-footnote"><span><Sparkles size={14} /> SMALL LABELS, BIG POINTS OF VIEW.</span><span>SELLER STUDIO&nbsp; · &nbsp;01</span></div>
        </div>}

        {dashboardTab === 'products' && <div className="dashboard-page">
          <div className="dashboard-heading"><div><span className="eyebrow">YOUR CATALOG</span><h1>Products</h1><p>Only approved products are live in your seller store.</p></div><button className="button button-primary" type="button" onClick={() => setDashboardTab('add-product')}><Plus size={17} /> Add product</button></div>
          <section className="catalog-panel"><div className="catalog-toolbar"><div><strong>Live products</strong><span>{approvedProducts.length} approved</span></div><span className="catalog-filter"><span className="filter-dot" /> APPROVED</span></div>
            {matchingProducts.length > 0 ? <div className="product-table-wrap"><table className="product-table"><thead><tr><th>PRODUCT</th><th>CATEGORY</th><th>SELLER PRICE</th><th>STOCK</th><th>STATUS</th></tr></thead><tbody>{matchingProducts.map((product) => <tr key={product.id}><td><div className="product-cell"><img src={product.imageUrl} alt="" /><span><strong>{product.name}</strong><small>{product.id}</small></span></div></td><td>{product.category}<small className="table-subtext">{product.subcategory}</small></td><td>₹{(product.sellingPrice ?? product.cost).toLocaleString('en-IN')}</td><td>{Object.values(product.stock).reduce((sum, count) => sum + count, 0)} units</td><td><span className="status-pill approved-pill"><Check size={12} /> Live</span></td></tr>)}</tbody></table></div> : <div className="empty-catalog"><div className="empty-icon"><ShoppingBag size={23} /></div><h3>{approvedProducts.length ? 'No matching products' : 'Your first product belongs here.'}</h3><p>{approvedProducts.length ? 'Try a different search.' : 'Submit a product for review. Once approved, it will appear in this catalog.'}</p>{!approvedProducts.length && <button className="button button-primary" type="button" onClick={() => setDashboardTab('add-product')}><Plus size={16} /> Add a product</button>}</div>}
          </section>
          {products.some((product) => product.status === 'pending') && <section className="catalog-panel pending-catalog"><div className="catalog-toolbar"><div><strong>Awaiting approval</strong><span>Not yet visible in your live catalog</span></div><Clock3 size={17} /></div><div className="queue-list">{products.filter((product) => product.status === 'pending').map((product) => <div className="queue-item" key={product.id}><span className="queue-image" style={{ backgroundImage: `url(${product.imageUrl})` }} /><span className="queue-product"><strong>{product.name}</strong><small>{product.id} · {product.category} / {product.subcategory}</small></span><span className="status-pill pending-pill">In review</span></div>)}</div></section>}
        </div>}

        {dashboardTab === 'orders' && <div className="dashboard-page"><div className="dashboard-heading"><div><span className="eyebrow">SELLER ORDERS</span><h1>Orders</h1><p>Orders containing your products, identified by customer ID.</p></div></div><section className="catalog-panel"><div className="catalog-toolbar"><div><strong>Recent orders</strong><span>{orders.length} orders</span></div></div>{orders.length ? <div className="product-table-wrap"><table className="product-table"><thead><tr><th>ORDER</th><th>CUSTOMER ID</th><th>PRODUCTS</th><th>PAYMENT</th><th>STATUS</th></tr></thead><tbody>{orders.map((order) => <tr key={order._id}><td>{order._id.slice(-8).toUpperCase()}<small className="table-subtext">{new Date(order.createdAt).toLocaleString('en-IN')}</small></td><td>{order.customerId}</td><td>{order.items.reduce((total, item) => total + Number(item.quantity || 0), 0)} units</td><td>{paymentLabel(order)}</td><td><span className="status-pill approved-pill">{order.status}</span></td></tr>)}</tbody></table></div> : <div className="empty-catalog"><div className="empty-icon"><PackageCheck size={23} /></div><h3>No orders yet</h3><p>Orders containing your approved products will appear here.</p></div>}</section></div>}

        {dashboardTab === 'orders' && orders.length > 0 && <div className="dashboard-page order-actions-page"><section className="catalog-panel"><div className="catalog-toolbar"><div><strong>Update fulfilment status</strong><span>Move each order through your fulfilment workflow. To mark an order delivered, enter the OTP the customer reads out from the SMS we sent them.</span></div></div>{backendNotice && <p className="backend-notice order-action-notice" role="alert">{backendNotice}</p>}<div className="seller-order-actions">{orders.map((order) => <div className={`seller-order-action${deliveryOtps[order._id] !== undefined ? ' is-confirming' : ''}`} key={order._id}><span><strong>{order._id.slice(-8).toUpperCase()}</strong><small>{order.customerId}</small>{order.deliveryPartner && <small className="partner-pickup">Pickup by {order.deliveryPartner.name} · {order.deliveryPartner.phone}{order.deliveryPartner.vehicleNumber ? ` · ${order.deliveryPartner.vehicleNumber}` : ''}</small>}{order.pickup?.codeSent && <span className="pickup-code"><small>Your pickup code has been sent to you by SMS. Read it to the partner only when you hand over the parcel.</small><button className="text-button" type="button" disabled={resending === order._id} onClick={() => void resendCode(order._id, `/seller/orders/${order._id}/pickup-code`)}>{resending === order._id ? 'Sending…' : 'Resend code'}</button></span>}{order.pickup?.pickedUpAt && <small className="partner-pickup">Handed over {new Date(order.pickup.pickedUpAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}</small>}</span>{deliveryOtps[order._id] !== undefined && <form className="delivery-otp-form" onSubmit={(event) => { event.preventDefault(); void updateOrderStatus(order._id, 'delivered', deliveryOtps[order._id]) }}><label><span>Customer's delivery OTP</span><input className="control" inputMode="numeric" autoComplete="one-time-code" maxLength={4} placeholder="4 digits" aria-label={`Delivery OTP for order ${order._id.slice(-8).toUpperCase()}`} value={deliveryOtps[order._id]} onChange={(event) => setDeliveryOtps((current) => ({ ...current, [order._id]: event.target.value.replace(/\D/g, '').slice(0, 4) }))} autoFocus /></label><button className="button button-primary" type="submit" disabled={deliveryOtps[order._id].length !== 4}><Check size={15} /> Confirm delivery</button><button className="button delivery-otp-cancel" type="button" onClick={() => setDeliveryOtps((current) => { const next = { ...current }; delete next[order._id]; return next })}>Cancel</button></form>}<select className="control" value={order.status} disabled={order.items.some((item) => item.returnRequest) || order.status === 'cancelled' || awaitingUpi(order) || partnerHandling(order)} title={order.items.some((item) => item.returnRequest) ? 'Orders with a return request keep their delivered status' : awaitingUpi(order) ? 'Waiting for admin to verify the UPI payment' : partnerHandling(order) ? 'The delivery partner updates this order from pickup to delivery' : order.deliveryPartner ? 'Mark the order packed; the delivery partner takes it from there' : undefined} onChange={(event) => { if (event.target.value === 'delivered') setDeliveryOtps((current) => ({ ...current, [order._id]: '' })); else void updateOrderStatus(order._id, event.target.value) }}><option value="placed">Placed</option><option value="packed">Packed</option><option value="shipped" disabled={Boolean(order.deliveryPartner) && order.status !== 'shipped'}>Shipped</option><option value="out_for_delivery" disabled={Boolean(order.deliveryPartner) && order.status !== 'out_for_delivery'}>Out for delivery</option><option value="delivered" disabled={Boolean(order.deliveryPartner) && order.status !== 'delivered'}>Delivered</option>{order.status === 'cancelled' && <option value="cancelled">Cancelled</option>}</select></div>)}</div></section></div>}

        {dashboardTab === 'returns' && <div className="dashboard-page">
          <div className="dashboard-heading"><div><span className="eyebrow">AFTER DELIVERY</span><h1>Returns</h1><p>Customers can ask to return delivered items within 7 days. Accepting a return sends a delivery partner to collect the item and bring it back to you; it goes back into your stock when it arrives. If you reject it, tell the customer why.</p></div></div>
          {backendNotice && <p className="backend-notice" role="alert">{backendNotice}</p>}
          {incomingReturns.length > 0 && <section className="catalog-panel"><div className="catalog-toolbar"><div><strong>Returns on their way back</strong><span>When the partner hands you the items, check them and give the partner the return code we texted you.</span></div></div>
            <div className="restock-list">{incomingReturns.map(({ order, item }) => <article className="restock-card return-card return-incoming" key={item._id}>
              <div className="restock-product">{item.imageUrl ? <img src={item.imageUrl} alt="" /> : null}<span><strong>{item.name}</strong><small>{item.size && item.size !== 'One size' ? `Size ${item.size} · ` : ''}Qty {item.quantity} · Order {order._id.slice(-8).toUpperCase()}</small>{item.returnPickup?.partner && <small>With {item.returnPickup.partner.name} · {item.returnPickup.partner.phone}{item.returnPickup.partner.vehicleNumber ? ` · ${item.returnPickup.partner.vehicleNumber}` : ''}</small>}</span></div>
              <div className="return-code"><span className="eyebrow">RETURN CODE</span><small>Sent to you by SMS. Give it only once you have the items.</small><button className="text-button" type="button" disabled={resending === item._id} onClick={() => void resendCode(item._id, `/seller/orders/${order._id}/items/${item._id}/return-code`)}>{resending === item._id ? 'Sending…' : 'Resend code'}</button></div>
            </article>)}</div>
          </section>}
          <section className="catalog-panel"><div className="catalog-toolbar"><div><strong>Awaiting your decision</strong><span>{openReturns.length} open request{openReturns.length === 1 ? '' : 's'}</span></div></div>
            {openReturns.length ? <div className="restock-list">{openReturns.map(({ order, item, request }) => <article className="restock-card return-card" key={item._id}>
              <div className="restock-product">{item.imageUrl ? <img src={item.imageUrl} alt="" /> : null}<span><strong>{item.name}</strong><small>{item.size && item.size !== 'One size' ? `Size ${item.size} · ` : ''}Qty {item.quantity} · Order {order._id.slice(-8).toUpperCase()} · Customer {order.customerId}</small><small>Requested {new Date(request.requestedAt).toLocaleString('en-IN')}{order.deliveredAt ? ` · delivered ${new Date(order.deliveredAt).toLocaleDateString('en-IN')}` : ''}</small></span></div>
              <div className="return-customer"><span className="eyebrow">CUSTOMER'S REASON</span><strong>{request.reason}</strong><p>“{request.message}”</p></div>
              <label className="return-reply"><span>Message to the customer <small>(required if you reject)</small></span><textarea className="control textarea" maxLength={500} value={returnReplies[item._id] ?? ''} onChange={(event) => setReturnReplies((current) => ({ ...current, [item._id]: event.target.value }))} placeholder="e.g. The tag has been removed and the item shows signs of wear, so it can't be resold." /></label>
              <div className="return-actions"><button className="button button-primary" type="button" disabled={returnBusy === item._id} onClick={() => void decideReturn(order, item, 'approved')}><Check size={16} /> Accept return</button><button className="button return-reject" type="button" disabled={returnBusy === item._id} onClick={() => void decideReturn(order, item, 'rejected')}>Reject return</button></div>
            </article>)}</div> : <div className="empty-catalog"><div className="empty-icon"><RotateCcw size={23} /></div><h3>No open return requests</h3><p>When a customer asks to return one of your delivered items, it will appear here.</p></div>}
          </section>
          {returnRequests.some((entry) => entry.request.status !== 'requested') && <section className="catalog-panel"><div className="catalog-toolbar"><div><strong>Resolved returns</strong><span>Your past decisions</span></div></div><div className="product-table-wrap"><table className="product-table returns-table"><thead><tr><th>PRODUCT</th><th>CUSTOMER REASON</th><th>DECISION</th><th>PICKUP</th><th>YOUR MESSAGE</th></tr></thead><tbody>{returnRequests.filter((entry) => entry.request.status !== 'requested').map(({ order, item, request }) => <tr key={item._id}><td>{item.name}<small className="table-subtext">{item.size && item.size !== 'One size' ? `Size ${item.size} · ` : ''}Qty {item.quantity} · {order._id.slice(-8).toUpperCase()}</small></td><td>{request.reason}<small className="table-subtext">“{request.message}”</small></td><td><span className={`status-pill ${request.status === 'approved' ? 'approved-pill' : 'rejected-pill'}`}>{request.status === 'approved' ? 'Accepted' : 'Rejected'}</span><small className="table-subtext">{request.resolvedAt ? new Date(request.resolvedAt).toLocaleDateString('en-IN') : ''}{request.restockedQuantity ? ` · +${request.restockedQuantity} to stock` : ''}</small></td><td>{item.returnPickup ? <>{returnPickupLabels[item.returnPickup.status]}{item.returnPickup.partner && item.returnPickup.status !== 'returned' && <small className="table-subtext">{item.returnPickup.partner.name} · {item.returnPickup.partner.phone}</small>}{item.returnPickup.returnedAt && <small className="table-subtext">{new Date(item.returnPickup.returnedAt).toLocaleDateString('en-IN')}</small>}</> : '—'}</td><td>{request.sellerMessage || '—'}</td></tr>)}</tbody></table></div></section>}
        </div>}

        {dashboardTab === 'restock' && <div className="dashboard-page">
          <div className="dashboard-heading"><div><span className="eyebrow">STOCK</span><h1>Restock requests</h1><p>Admin has asked you to restock these products. Add stock per size and it goes live on the store right away.</p></div></div>
          <section className="catalog-panel"><div className="catalog-toolbar"><div><strong>Awaiting your stock</strong><span>{restockRequests.filter((entry) => entry.status === 'open').length} open requests</span></div></div>
            {restockRequests.some((entry) => entry.status === 'open') ? <div className="restock-list">{restockRequests.filter((entry) => entry.status === 'open').map((entry) => <article className="restock-card" key={entry._id}>
              <div className="restock-product">{entry.product.imageUrl ? <img src={entry.product.imageUrl} alt="" /> : null}<span><strong>{entry.product.name}</strong><small>Requested {new Date(entry.createdAt).toLocaleDateString('en-IN')}</small>{Object.keys(entry.requestedStock ?? {}).length > 0 && <small className="restock-asked">Admin asked for {Object.entries(entry.requestedStock ?? {}).map(([size, count]) => `${count} × ${size}`).join(', ')}</small>}</span></div>
              <div className="restock-sizes">{Object.entries(entry.product.stock ?? {}).map(([size, count]) => <label className="restock-size" key={size}><span>{size}</span><small className={Number(count) < 1 ? 'is-empty' : ''}>{count} in stock</small><input className="control" type="number" min="0" inputMode="numeric" placeholder="+ add" aria-label={`Add ${size} stock for ${entry.product.name}`} value={restockValue(entry, size)} onChange={(event) => setRestockDrafts((current) => ({ ...current, [entry._id]: { ...(current[entry._id] ?? {}), [size]: event.target.value } }))} /></label>)}</div>
              <button className="button button-primary" type="button" onClick={() => void addRestockStock(entry._id)}><Plus size={16} /> Add stock</button>
            </article>)}</div> : <div className="empty-catalog"><div className="empty-icon"><Boxes size={23} /></div><h3>No restock requests</h3><p>When admin asks you to restock a product, it will appear here.</p></div>}
          </section>
          {restockRequests.some((entry) => entry.status === 'fulfilled') && <section className="catalog-panel"><div className="catalog-toolbar"><div><strong>Recently restocked</strong><span>Stock you added for admin requests</span></div></div><div className="product-table-wrap"><table className="product-table"><thead><tr><th>PRODUCT</th><th>ASKED FOR</th><th>ADDED</th><th>DATE</th></tr></thead><tbody>{restockRequests.filter((entry) => entry.status === 'fulfilled').map((entry) => <tr key={entry._id}><td>{entry.product.name}</td><td>{Object.entries(entry.requestedStock ?? {}).map(([size, count]) => `${size}: ${count}`).join(', ') || '—'}</td><td>{Object.entries(entry.addedStock ?? {}).map(([size, count]) => `${size}: +${count}`).join(', ')}</td><td>{entry.fulfilledAt ? new Date(entry.fulfilledAt).toLocaleString('en-IN') : ''}</td></tr>)}</tbody></table></div></section>}
        </div>}

        {dashboardTab === 'add-product' && <div className="dashboard-page add-product-page">
          <button className="back-link" type="button" onClick={() => setDashboardTab('products')}><ArrowLeft size={15} /> Back to products</button>
          <div className="dashboard-heading add-product-heading"><div><span className="eyebrow">PRODUCT SUBMISSION</span><h1>Add a product</h1><p>Product details are reviewed before they go live in your store.</p></div><span className="draft-status"><span /> DRAFT</span></div>
          <form className="product-form-layout" onSubmit={submitProduct}>
            <div className="product-form-main">
              <section className="product-form-card"><div className="product-form-card-heading"><span className="form-icon"><ShoppingBag size={17} /></span><div><h2>Product details</h2><p>Give your product a name customers will remember.</p></div></div><div className="field-grid">
                <TextField label="Product name" placeholder="e.g. The Sunday Linen Shirt" value={productDraft.name} onChange={(event) => updateProduct('name', event.target.value)} required />
                <TextField label="Tagline" placeholder="A short line with a point of view" value={productDraft.tagline} onChange={(event) => updateProduct('tagline', event.target.value)} required />
                <SelectField label="Category" value={productDraft.category} onChange={(event) => { const category = event.target.value; setProductDraft((current) => ({ ...current, category, subcategory: categories[category][0], stock: {} })) }} required>{Object.keys(categories).map((category) => <option key={category}>{category}</option>)}</SelectField>
                <SelectField label="Subcategory" value={productDraft.subcategory} onChange={(event) => setProductDraft((current) => ({ ...current, subcategory: event.target.value, stock: {} }))} required>{categories[productDraft.category].map((subcategory) => <option key={subcategory}>{subcategory}</option>)}</SelectField>
                <TextField label="Actual product price (₹)" type="number" min="1" step="1" placeholder="0.00" value={productDraft.cost} onChange={(event) => updateProduct('cost', event.target.value)} required />
                <div className="field field-description"><label htmlFor="product-description">Product description</label><textarea id="product-description" className="control textarea" placeholder="Fabric, fit, care details and anything else customers should know..." value={productDraft.description} onChange={(event) => updateProduct('description', event.target.value)} minLength={20} required /></div>
              </div></section>
              <section className="product-form-card"><div className="product-form-card-heading"><span className="form-icon"><Boxes size={17} /></span><div><h2>Available stock</h2><p>Enter stock for each size in this subcategory.</p></div><span className="size-type">{productDraft.category === 'Footwear' ? 'FOOTWEAR SIZES' : productDraft.category === 'Accessories' ? 'ONE SIZE' : 'APPAREL SIZES'}</span></div><div className="stock-grid">{sizeOptions.map((size) => <label className="stock-field" key={size}><span>{size}</span><input aria-label={`${size} stock`} type="number" min="0" step="1" placeholder="0" value={productDraft.stock[size] ?? ''} onChange={(event) => setProductDraft((current) => ({ ...current, stock: { ...current.stock, [size]: event.target.value } }))} required /></label>)}</div><div className="stock-total"><span>Total units available</span><strong>{Object.values(productDraft.stock).reduce((sum, count) => sum + Number(count || 0), 0)}</strong></div></section>
              <div className="product-submit-row"><span><ShieldCheck size={15} /> You can edit details before approval.</span><button className="button button-primary" type="submit"><FileCheck2 size={16} /> Submit for approval</button></div>
            </div>
            <aside className="product-form-side"><div className="product-form-card image-card"><div className="product-form-card-heading"><span className="form-icon"><ImagePlus size={17} /></span><div><h2>Product image</h2><p>Paste a public image URL.</p></div></div><TextField label="Image URL" type="url" placeholder="https://..." value={productDraft.imageUrl} onChange={(event) => updateProduct('imageUrl', event.target.value)} required />{productDraft.imageUrl ? <img className="image-preview" src={productDraft.imageUrl} alt="Product preview" onError={(event) => { event.currentTarget.style.display = 'none' }} /> : <div className="image-placeholder"><ImagePlus size={24} /><span>IMAGE PREVIEW</span></div>}</div><div className="submission-note"><Clock3 size={16} /><span><strong>What happens next?</strong><small>Our catalog team reviews your submission. Once approved, the product appears in your live products page.</small></span></div></aside>
          </form>
        </div>}
      </section>
    </main>
  )
}

export default App
