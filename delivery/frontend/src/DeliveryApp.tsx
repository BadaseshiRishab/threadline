import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { ArrowRight, Bike, CircleCheck, CircleX, Clock3, Hand, IndianRupee, KeyRound, LogOut, MapPin, Navigation, Package, PackageCheck, Phone, RefreshCw, ShieldCheck, Store, Truck, Undo2, UserRound } from 'lucide-react'
import { api, ApiError } from './api'
import './DeliveryApp.css'

type ApplicationStatus = 'pending' | 'approved' | 'rejected'
type Partner = { id: string; name: string; email: string; phone: string; vehicleType: string; vehicleNumber: string; licenceNumber: string; area: string; documents: Record<DocumentKind, boolean>; status: ApplicationStatus; reviewNote: string; appliedAt?: string }
type Address = { line: string; city: string; state: string; pincode: string; type?: string }
type Pickup = Address & { sellerId: string; name: string; phone: string; pickedUpAt?: string | null; items: Array<{ _id: string; name: string; size?: string; quantity: number; imageUrl?: string }> }
type DeliveryStatus = 'placed' | 'packed' | 'shipped' | 'out_for_delivery' | 'delivered' | 'cancelled'
type Delivery = { _id: string; status: DeliveryStatus; createdAt: string; assignedAt?: string; deliveredAt?: string; total: number; paymentMethod: string; cashToCollect: number; cashCollected: number; customer: { name: string; phone: string }; address: Address; pickups: Pickup[]; itemCount: number }
type AvailableOrder = { _id: string; status: DeliveryStatus; createdAt: string; total: number; paymentMethod: string; cashToCollect: number; itemCount: number; dropArea: { city: string; pincode: string }; pickups: Array<{ sellerId: string; name: string; city: string; pincode: string; itemCount: number }> }
type DocumentKind = 'licence' | 'rc'
// Return pickups: collect accepted returns from the customer and bring them back to the seller.
type ReturnStatus = 'awaiting_partner' | 'assigned' | 'picked_up' | 'returned'
type ReturnItem = { _id: string; name: string; size?: string; quantity: number; imageUrl?: string }
type ReturnJob = { _id: string; orderId: string; status: ReturnStatus; requestedAt?: string; assignedAt?: string; pickedUpAt?: string; returnedAt?: string; customer: { name: string; phone: string }; address: Address; seller: Address & { sellerId: string; name: string; phone: string }; items: ReturnItem[]; itemCount: number }
type AvailableReturn = { _id: string; orderId: string; requestedAt?: string; itemCount: number; pickupArea: { city: string; pincode: string }; seller: { name: string; city: string; pincode: string } }
type ReturnJobs = { available: AvailableReturn[]; active: ReturnJob[]; completed: ReturnJob[] }
type Tab = 'available' | 'active' | 'completed' | 'account'
type ApplicationDraft = { name: string; email: string; phone: string; password: string; vehicleType: string; vehicleNumber: string; licenceNumber: string; area: string }

const vehicleTypes = ['Bike', 'Scooter', 'Bicycle', 'Van']
const emptyApplication: ApplicationDraft = { name: '', email: '', phone: '', password: '', vehicleType: 'Bike', vehicleNumber: '', licenceNumber: '', area: '' }
// Uploaded with the application; the API stores them privately for the review team.
const documentKinds: Array<{ kind: DocumentKind; field: string; label: string }> = [
  { kind: 'licence', field: 'licenceDoc', label: 'Driving licence photo' },
  { kind: 'rc', field: 'rcDoc', label: 'Vehicle RC photo' },
]
const documentTypes = ['image/jpeg', 'image/png', 'application/pdf']
const maxDocumentSize = 5 * 1024 * 1024
const rupees = (value: number) => `₹${Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`
const orderNumber = (id: string) => id.slice(-8).toUpperCase()
const time = (value?: string) => value ? new Date(value).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) : ''
const addressText = (address: Address) => [address.line, address.city, address.state, address.pincode].filter(Boolean).join(', ')
const mapsLink = (address: Address) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addressText(address))}`
const isToday = (value?: string) => Boolean(value) && new Date(value!).toDateString() === new Date().toDateString()
const minutesAgo = (value: string) => {
  const minutes = Math.max(0, Math.round((Date.now() - new Date(value).getTime()) / 60000))
  return minutes < 60 ? `${minutes} min ago` : minutes < 1440 ? `${Math.round(minutes / 60)} h ago` : time(value)
}

// The partner's side of the order journey. "shipped" is shown as picked up, because that is what it means here.
const stageLabels: Record<DeliveryStatus, string> = { placed: 'Waiting for seller to pack', packed: 'Ready for pickup', shipped: 'Picked up', out_for_delivery: 'Out for delivery', delivered: 'Delivered', cancelled: 'Cancelled' }
const stages: DeliveryStatus[] = ['packed', 'shipped', 'out_for_delivery', 'delivered']
const returnLabels: Record<ReturnStatus, string> = { awaiting_partner: 'Waiting for a partner', assigned: 'Collect from customer', picked_up: 'Return to seller', returned: 'Returned to seller' }
const emptyReturns: ReturnJobs = { available: [], active: [], completed: [] }

function DeliveryApp() {
  const [partner, setPartner] = useState<Partner | null>(null)
  const [authReady, setAuthReady] = useState(false)
  const [authMode, setAuthMode] = useState<'login' | 'apply'>('login')
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [application, setApplication] = useState<ApplicationDraft>(emptyApplication)
  const [documents, setDocuments] = useState<Partial<Record<DocumentKind, File>>>({})
  const [authError, setAuthError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [tab, setTab] = useState<Tab>('available')
  const [available, setAvailable] = useState<AvailableOrder[]>([])
  const [active, setActive] = useState<Delivery[]>([])
  const [completed, setCompleted] = useState<Delivery[]>([])
  const [returns, setReturns] = useState<ReturnJobs>(emptyReturns)
  const [maxOpenJobs, setMaxOpenJobs] = useState(5)
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [otps, setOtps] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState<Record<string, boolean>>({})
  const [cardErrors, setCardErrors] = useState<Record<string, string>>({})
  const [notice, setNotice] = useState('')
  const [editingApplication, setEditingApplication] = useState(false)
  // OTP: login with a code instead of a password, and mobile verification when applying.
  const [otpConfig, setOtpConfig] = useState({ signupOtp: false, loginOtpPhone: false, loginOtpEmail: false })
  const [loginMethod, setLoginMethod] = useState<'password' | 'otp'>('password')
  const [otpSentTo, setOtpSentTo] = useState('')
  const [otpCode, setOtpCode] = useState('')
  const [otpBusy, setOtpBusy] = useState(false)
  const [passwordDraft, setPasswordDraft] = useState({ current: '', next: '', confirm: '' })
  const [passwordMessage, setPasswordMessage] = useState<{ ok: boolean; text: string } | null>(null)

  const refreshMe = useCallback(async () => {
    try {
      const { partner: me } = await api<{ partner: Partner }>('/auth/me')
      setPartner(me)
    } catch (error) {
      setPartner(null)
      if (error instanceof ApiError && error.status === 403) setAuthError(error.message)
    }
  }, [])

  useEffect(() => { void refreshMe().finally(() => setAuthReady(true)) }, [refreshMe])
  useEffect(() => { void api<typeof otpConfig>('/auth/otp-config').then(setOtpConfig).catch(() => undefined) }, [])

  const showNotice = (message: string) => {
    setNotice(message)
    window.setTimeout(() => setNotice((current) => current === message ? '' : current), 3200)
  }

  const approved = partner?.status === 'approved'

  const loadDeliveries = useCallback(async () => {
    setLoading(true)
    try {
      const result = await api<{ available: AvailableOrder[]; active: Delivery[]; completed: Delivery[]; returns?: ReturnJobs; maxOpenJobs: number }>('/deliveries')
      setAvailable(result.available)
      setActive(result.active)
      setCompleted(result.completed)
      setReturns(result.returns ?? emptyReturns)
      setMaxOpenJobs(result.maxOpenJobs)
      setLoadError('')
      setLastUpdated(new Date())
    } catch (error) {
      // Signed out, deactivated, or no longer approved: re-read the account to show the right screen.
      if (error instanceof ApiError && (error.status === 401 || error.status === 403)) { await refreshMe(); return }
      setLoadError(error instanceof Error ? error.message : 'Could not load deliveries.')
    } finally {
      setLoading(false)
    }
  }, [refreshMe])

  // Approved partners see new orders in the pool without reloading; applicants see the review result the same way.
  useEffect(() => {
    if (!partner) return
    const refresh = () => { if (document.visibilityState === 'visible') void (approved ? loadDeliveries() : refreshMe()) }
    if (approved) void loadDeliveries()
    const timer = window.setInterval(refresh, approved ? 30_000 : 60_000)
    return () => window.clearInterval(timer)
  }, [partner?.id, approved, loadDeliveries, refreshMe]) // eslint-disable-line react-hooks/exhaustive-deps

  const resetOtp = () => { setOtpSentTo(''); setOtpCode('') }
  const sendOtp = async (kind: 'login' | 'signup') => {
    setOtpBusy(true)
    setAuthError('')
    try {
      const target = kind === 'login' ? identifier.trim() : application.phone
      const result = await api<{ message: string }>(kind === 'login' ? '/auth/login-otp' : '/auth/signup-otp', { method: 'POST', body: kind === 'login' ? { identifier: target } : { phone: target } })
      setOtpSentTo(target)
      setOtpCode('')
      showNotice(result.message)
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : 'Could not send the code.')
    } finally {
      setOtpBusy(false)
    }
  }
  // The mobile number needs a code at sign-up, and again if a rejected applicant changes it. The email is not verified.
  const phoneNeedsCode = otpConfig.signupOtp && (!partner || application.phone !== partner.phone)
  const phoneCodePending = phoneNeedsCode && otpSentTo !== application.phone

  const signIn = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (loginMethod === 'otp' && otpSentTo !== identifier.trim()) { await sendOtp('login'); return }
    setSubmitting(true)
    setAuthError('')
    try {
      const result = loginMethod === 'otp'
        ? await api<{ partner: Partner }>('/auth/login-otp/verify', { method: 'POST', body: { identifier, code: otpCode } })
        : await api<{ partner: Partner }>('/auth/login', { method: 'POST', body: { identifier, password } })
      resetOtp()
      setPartner(result.partner)
      setPassword('')
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : 'Could not sign in.')
    } finally {
      setSubmitting(false)
    }
  }

  const submitApplication = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (phoneCodePending) {
      if (!/^[6-9]\d{9}$/.test(application.phone)) { setAuthError('Enter a valid 10-digit Indian mobile number.'); return }
      await sendOtp('signup')
      return
    }
    const missingDocument = application.vehicleType !== 'Bicycle' && documentKinds.find(({ kind }) => !documents[kind] && !partner?.documents?.[kind])
    if (missingDocument) { setAuthError(`Upload your ${missingDocument.label.toLowerCase()}.`); return }
    setSubmitting(true)
    setAuthError('')
    try {
      const resubmitting = Boolean(partner)
      const body = new FormData()
      for (const [key, value] of Object.entries({ ...application, otp: otpCode })) body.append(key, value)
      for (const { kind, field } of documentKinds) if (documents[kind]) body.append(field, documents[kind])
      const result = await api<{ partner: Partner }>(resubmitting ? '/auth/application' : '/auth/register', { method: resubmitting ? 'PUT' : 'POST', body })
      resetOtp()
      setPartner(result.partner)
      setEditingApplication(false)
      setApplication(emptyApplication)
      setDocuments({})
      if (resubmitting) showNotice('Application resubmitted')
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : 'Could not submit your application.')
    } finally {
      setSubmitting(false)
    }
  }

  const signOut = async () => {
    await api('/auth/logout', { method: 'POST' }).catch(() => undefined)
    setPartner(null)
    setAvailable([])
    setActive([])
    setCompleted([])
    setReturns(emptyReturns)
    setTab('available')
    setAuthMode('login')
    setAuthError('')
  }

  const runCardAction = async (id: string, action: () => Promise<void>) => {
    setBusy((current) => ({ ...current, [id]: true }))
    setCardErrors((current) => ({ ...current, [id]: '' }))
    try {
      await action()
    } catch (error) {
      setCardErrors((current) => ({ ...current, [id]: error instanceof Error ? error.message : 'Something went wrong. Try again.' }))
      // A taken or vanished order should disappear from the pool on the next refresh.
      if (error instanceof ApiError && error.status === 409) void loadDeliveries()
    } finally {
      setBusy((current) => ({ ...current, [id]: false }))
    }
  }

  const acceptOrder = (order: AvailableOrder) => runCardAction(order._id, async () => {
    const result = await api<{ order: Delivery }>(`/deliveries/${order._id}/accept`, { method: 'POST' })
    setAvailable((current) => current.filter((entry) => entry._id !== order._id))
    setActive((current) => [...current, result.order])
    showNotice(`Order #${orderNumber(order._id)} is yours`)
    setTab('active')
  })

  const releaseOrder = (delivery: Delivery) => runCardAction(delivery._id, async () => {
    if (!window.confirm(`Release order #${orderNumber(delivery._id)}? It goes back to the pool for other partners.`)) return
    await api(`/deliveries/${delivery._id}/release`, { method: 'POST' })
    setActive((current) => current.filter((entry) => entry._id !== delivery._id))
    showNotice('Order released')
    void loadDeliveries()
  })

  // Codes are typed per seller, because an order with items from two sellers is collected from two places.
  const pickupKey = (delivery: Delivery, pickup: Pickup) => `${delivery._id}:${pickup.sellerId}`
  const confirmPickup = (delivery: Delivery, pickup: Pickup) => runCardAction(delivery._id, async () => {
    const key = pickupKey(delivery, pickup)
    const { order } = await api<{ order: Delivery }>(`/deliveries/${delivery._id}/pickup`, { method: 'POST', body: { sellerId: pickup.sellerId, otp: otps[key] || '' } })
    setActive((current) => current.map((entry) => entry._id === order._id ? order : entry))
    setOtps((current) => { const next = { ...current }; delete next[key]; return next })
    showNotice(order.status === 'shipped' ? 'Order picked up. Head to the customer.' : `Collected from ${pickup.name}`)
  })

  const advance = (delivery: Delivery, status: DeliveryStatus) => runCardAction(delivery._id, async () => {
    const otp = otps[delivery._id] || ''
    const { order } = await api<{ order: Delivery }>(`/deliveries/${delivery._id}/status`, { method: 'PATCH', body: status === 'delivered' ? { status, otp } : { status } })
    if (order.status === 'delivered') {
      setActive((current) => current.filter((entry) => entry._id !== order._id))
      setCompleted((current) => [order, ...current])
      showNotice(order.cashCollected ? `Delivered. Collected ${rupees(order.cashCollected)} cash.` : 'Delivered. Nice work!')
    } else {
      setActive((current) => current.map((entry) => entry._id === order._id ? order : entry))
      showNotice(stageLabels[order.status])
    }
    setOtps((current) => { const next = { ...current }; delete next[delivery._id]; return next })
  })

  // Return pickups: accept from the pool, collect with the customer's return code, drop off with the seller's.
  const updateReturn = (job: ReturnJob) => setReturns((current) => job.status === 'returned'
    ? { ...current, active: current.active.filter((entry) => entry._id !== job._id), completed: [job, ...current.completed] }
    : { ...current, active: current.active.map((entry) => entry._id === job._id ? job : entry) })
  const acceptReturn = (job: AvailableReturn) => runCardAction(job._id, async () => {
    const result = await api<{ job: ReturnJob }>(`/deliveries/returns/${job._id}/accept`, { method: 'POST' })
    setReturns((current) => ({ ...current, available: current.available.filter((entry) => entry._id !== job._id), active: [...current.active, result.job] }))
    showNotice(`Return pickup for order #${orderNumber(job.orderId)} is yours`)
    setTab('active')
  })
  const releaseReturn = (job: ReturnJob) => runCardAction(job._id, async () => {
    if (!window.confirm(`Release the return pickup for order #${orderNumber(job.orderId)}? It goes back to the pool for other partners.`)) return
    await api(`/deliveries/returns/${job._id}/release`, { method: 'POST' })
    setReturns((current) => ({ ...current, active: current.active.filter((entry) => entry._id !== job._id) }))
    showNotice('Return pickup released')
    void loadDeliveries()
  })
  const advanceReturn = (job: ReturnJob) => runCardAction(job._id, async () => {
    const step = job.status === 'assigned' ? 'collect' : 'drop'
    const result = await api<{ job: ReturnJob }>(`/deliveries/returns/${job._id}/${step}`, { method: 'POST', body: { otp: otps[job._id] || '' } })
    updateReturn(result.job)
    setOtps((current) => { const next = { ...current }; delete next[job._id]; return next })
    showNotice(step === 'collect' ? 'Return collected. Take it to the seller.' : 'Returned to the seller. Nice work!')
  })

  const changePassword = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (passwordDraft.next !== passwordDraft.confirm) { setPasswordMessage({ ok: false, text: 'The new passwords do not match.' }); return }
    try {
      await api('/auth/password', { method: 'POST', body: { currentPassword: passwordDraft.current, newPassword: passwordDraft.next } })
      setPasswordDraft({ current: '', next: '', confirm: '' })
      setPasswordMessage({ ok: true, text: 'Password changed. Use it the next time you sign in.' })
    } catch (error) {
      setPasswordMessage({ ok: false, text: error instanceof Error ? error.message : 'Could not change your password.' })
    }
  }

  const bicycle = application.vehicleType === 'Bicycle'
  const chooseDocument = (kind: DocumentKind, file: File | undefined, input: HTMLInputElement) => {
    if (file && (!documentTypes.includes(file.type) || file.size > maxDocumentSize)) {
      input.value = ''
      setAuthError('Each document must be a JPEG, PNG or PDF under 5 MB.')
      file = undefined
    } else setAuthError('')
    setDocuments((current) => ({ ...current, [kind]: file }))
  }
  const renderApplicationForm = (resubmitting: boolean) => <form className="application-form" onSubmit={submitApplication}>
    <label className="field"><span>Full name</span><input autoComplete="name" value={application.name} maxLength={80} onChange={(event) => setApplication({ ...application, name: event.target.value })} required /></label>
    <label className="field"><span>Mobile number</span><input autoComplete="tel" inputMode="numeric" maxLength={10} placeholder="10-digit mobile" value={application.phone} onChange={(event) => setApplication({ ...application, phone: event.target.value.replace(/\D/g, '').slice(0, 10) })} required /></label>
    <label className="field wide"><span>Email</span><input type="email" autoComplete="email" value={application.email} onChange={(event) => setApplication({ ...application, email: event.target.value })} required /></label>
    {!resubmitting && <label className="field wide"><span>Create a password</span><input type="password" autoComplete="new-password" minLength={8} placeholder="At least 8 characters" value={application.password} onChange={(event) => setApplication({ ...application, password: event.target.value })} required /></label>}
    <fieldset className="field wide vehicle-picker"><legend>Vehicle</legend><div>{vehicleTypes.map((type) => <label className={application.vehicleType === type ? 'selected' : ''} key={type}><input type="radio" name="vehicle" value={type} checked={application.vehicleType === type} onChange={() => setApplication({ ...application, vehicleType: type })} />{type}</label>)}</div></fieldset>
    <label className="field"><span>Vehicle number{bicycle ? ' (optional)' : ''}</span><input placeholder="KA01AB1234" maxLength={14} value={application.vehicleNumber} onChange={(event) => setApplication({ ...application, vehicleNumber: event.target.value.toUpperCase() })} required={!bicycle} /></label>
    <label className="field"><span>Driving licence{bicycle ? ' (optional)' : ''}</span><input placeholder="KA0120190001234" maxLength={20} value={application.licenceNumber} onChange={(event) => setApplication({ ...application, licenceNumber: event.target.value.toUpperCase() })} required={!bicycle} /></label>
    {documentKinds.map(({ kind, label }) => {
      const onFile = resubmitting && partner?.documents?.[kind]
      return <label className="field document-field" key={kind}><span>{label}{bicycle ? ' (optional)' : ''}</span><input type="file" accept={documentTypes.join(',')} onChange={(event) => chooseDocument(kind, event.target.files?.[0], event.target)} required={!bicycle && !onFile && !documents[kind]} /><small>{documents[kind] ? documents[kind].name : onFile ? 'Already uploaded. Choose a file to replace it.' : 'JPEG, PNG or PDF, up to 5 MB'}</small></label>
    })}
    {phoneNeedsCode && otpSentTo === application.phone && <label className="field wide otp-field"><span>Mobile verification code</span><input inputMode="numeric" autoComplete="one-time-code" maxLength={6} placeholder="6-digit code" value={otpCode} onChange={(event) => setOtpCode(event.target.value.replace(/\D/g, '').slice(0, 6))} required autoFocus /><small>Sent to {otpSentTo}. <button className="link-button" type="button" disabled={otpBusy} onClick={() => void sendOtp('signup')}>Resend</button></small></label>}
    <label className="field wide"><span>Area you want to deliver in</span><input placeholder="e.g. Koramangala, HSR Layout" maxLength={80} value={application.area} onChange={(event) => setApplication({ ...application, area: event.target.value })} required /></label>
    {authError && <p className="form-error wide" role="alert">{authError}</p>}
    <button className="primary-button wide" type="submit" disabled={submitting || otpBusy}>{otpBusy ? 'Sending code…' : submitting ? 'Submitting…' : phoneCodePending ? 'Verify mobile number' : resubmitting ? 'Resubmit application' : <>Submit application <ArrowRight size={17} /></>}</button>
  </form>

  if (!authReady) return <main className="splash"><Truck size={28} /><span>Loading…</span></main>

  if (!partner) return (
    <main className="login-shell">
      <section className="login-hero">
        <span className="brand-mark"><Truck size={20} /> Threadline</span>
        <h1>Deliver with<br /><em>Threadline.</em></h1>
        <p>Pick the orders you want across Bangalore, on your own schedule.</p>
      </section>
      <section className="login-card">
        <div className="auth-switch" role="tablist">
          <button role="tab" aria-selected={authMode === 'login'} className={authMode === 'login' ? 'active' : ''} type="button" onClick={() => { setAuthMode('login'); setAuthError(''); resetOtp() }}>Sign in</button>
          <button role="tab" aria-selected={authMode === 'apply'} className={authMode === 'apply' ? 'active' : ''} type="button" onClick={() => { setAuthMode('apply'); setAuthError(''); resetOtp() }}>Become a partner</button>
        </div>
        {authMode === 'login' ? <>
          <span className="eyebrow"><ShieldCheck size={14} /> DELIVERY PARTNER</span>
          <h2>Sign in to start your shift</h2>
          {(otpConfig.loginOtpPhone || otpConfig.loginOtpEmail) && <div className="method-switch" role="tablist"><button role="tab" aria-selected={loginMethod === 'password'} className={loginMethod === 'password' ? 'active' : ''} type="button" onClick={() => { setLoginMethod('password'); resetOtp() }}>Password</button><button role="tab" aria-selected={loginMethod === 'otp'} className={loginMethod === 'otp' ? 'active' : ''} type="button" onClick={() => setLoginMethod('otp')}>One-time code</button></div>}
          <form className="login-form" onSubmit={signIn}>
            <label className="field"><span>Email or mobile number</span><input autoComplete="username" placeholder="you@example.com or 98XXXXXXXX" value={identifier} onChange={(event) => setIdentifier(event.target.value)} required /></label>
            {loginMethod === 'password'
              ? <label className="field"><span>Password</span><input type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required /></label>
              : otpSentTo === identifier.trim() && <label className="field otp-field"><span>Login code</span><input inputMode="numeric" autoComplete="one-time-code" maxLength={6} placeholder="6-digit code" value={otpCode} onChange={(event) => setOtpCode(event.target.value.replace(/\D/g, '').slice(0, 6))} required autoFocus /><small>Sent to {otpSentTo}. <button className="link-button" type="button" disabled={otpBusy} onClick={() => void sendOtp('login')}>Resend</button></small></label>}
            {authError && <p className="form-error" role="alert">{authError}</p>}
            <button className="primary-button" type="submit" disabled={submitting || otpBusy}>{otpBusy ? 'Sending code…' : submitting ? 'Signing in…' : loginMethod === 'otp' && otpSentTo !== identifier.trim() ? 'Send login code' : <>Sign in <ArrowRight size={17} /></>}</button>
          </form>
          <p className="login-note">New here? <button className="link-button" type="button" onClick={() => { setAuthMode('apply'); setAuthError('') }}>Apply to become a delivery partner</button>. Forgot your password? Ask the Threadline team to reset it.</p>
        </> : <>
          <span className="eyebrow"><Bike size={14} /> PARTNER APPLICATION</span>
          <h2>Apply to deliver</h2>
          <p className="login-lead">Tell us about you and your vehicle. Our team reviews every application, usually within a day. You can sign in to check its status.</p>
          {renderApplicationForm(false)}
        </>}
      </section>
    </main>
  )

  const topbar = <header className="topbar">
    <div className="topbar-inner">
      <span className="brand-mark"><Truck size={18} /> Threadline <small>Delivery</small></span>
      <div className="topbar-actions">
        <button className="icon-button" type="button" title="Refresh" aria-label="Refresh" disabled={loading} onClick={() => void (approved ? loadDeliveries() : refreshMe())}><RefreshCw size={17} className={loading ? 'spin' : ''} /></button>
        <button className="icon-button" type="button" title="Sign out" aria-label="Sign out" onClick={() => void signOut()}><LogOut size={17} /></button>
      </div>
    </div>
  </header>

  if (!approved) {
    const rejected = partner.status === 'rejected'
    return <div className="app-shell">
      {topbar}
      <main className="content">
        <section className={`application-status is-${partner.status}`}>
          <span className="status-icon">{rejected ? <CircleX size={28} /> : <Clock3 size={28} />}</span>
          <span className="eyebrow">{rejected ? 'APPLICATION NOT APPROVED' : 'APPLICATION RECEIVED'}</span>
          <h1>{rejected ? 'We couldn’t approve your application' : `Thanks, ${partner.name.split(' ')[0]}! We’re reviewing it`}</h1>
          {rejected
            ? <>{partner.reviewNote && <blockquote>“{partner.reviewNote}”</blockquote>}<p>Fix the details below and resubmit, and we will review it again.</p></>
            : <p>Applied {time(partner.appliedAt)}. Once approved you will see orders available for delivery right here; this page checks every minute.</p>}
        </section>
        {rejected && editingApplication
          ? <section className="panel"><h2 className="panel-title">Update your application</h2>{renderApplicationForm(true)}<button className="text-button" type="button" onClick={() => { setEditingApplication(false); setDocuments({}); setAuthError('') }}>Cancel</button></section>
          : <section className="panel">
            <h2 className="panel-title">Your application</h2>
            <dl className="detail-list">
              <div><dt>Name</dt><dd>{partner.name}</dd></div>
              <div><dt>Mobile</dt><dd>{partner.phone}</dd></div>
              <div><dt>Email</dt><dd>{partner.email}</dd></div>
              <div><dt>Vehicle</dt><dd>{partner.vehicleType}{partner.vehicleNumber ? ` · ${partner.vehicleNumber}` : ''}</dd></div>
              <div><dt>Driving licence</dt><dd>{partner.licenceNumber || '—'}</dd></div>
              <div><dt>Documents</dt><dd>{documentKinds.filter(({ kind }) => partner.documents?.[kind]).map(({ kind }, index) => <span key={kind}>{index > 0 && ' · '}<a className="link-button" href={`${process.env.API_BASE_URL || '/api'}/auth/documents/${kind}`} target="_blank" rel="noreferrer">{kind === 'rc' ? 'RC' : 'Licence'}</a></span>)}{!partner.documents?.licence && !partner.documents?.rc && '—'}</dd></div>
              <div><dt>Area</dt><dd>{partner.area}</dd></div>
            </dl>
            {rejected && <button className="primary-button" type="button" onClick={() => { setApplication({ name: partner.name, email: partner.email, phone: partner.phone, password: '', vehicleType: partner.vehicleType, vehicleNumber: partner.vehicleNumber, licenceNumber: partner.licenceNumber, area: partner.area }); setEditingApplication(true); setAuthError('') }}>Edit and resubmit</button>}
          </section>}
      </main>
      {notice && <div className="toast" role="status">{notice}</div>}
    </div>
  }

  const cashDue = active.reduce((total, delivery) => total + delivery.cashToCollect, 0)
  const deliveredToday = completed.filter((delivery) => isToday(delivery.deliveredAt))
  const cashCollectedToday = deliveredToday.reduce((total, delivery) => total + delivery.cashCollected, 0)
  const openJobs = active.length + returns.active.length
  const atCapacity = openJobs >= maxOpenJobs
  const returnedToday = returns.completed.filter((job) => isToday(job.returnedAt))

  const renderAvailable = (order: AvailableOrder) => {
    const working = Boolean(busy[order._id])
    return <article className="job-card offer-card" key={order._id}>
      <header className="job-head">
        <div><strong>Order #{orderNumber(order._id)}</strong><small>Placed {minutesAgo(order.createdAt)} · {order.itemCount} item{order.itemCount === 1 ? '' : 's'}</small></div>
        <span className="stage-chip is-packed">Packed · ready</span>
      </header>
      <div className="route">
        <div><span className="route-dot pickup" /><div><small>PICK UP</small>{order.pickups.map((pickup) => <strong key={pickup.sellerId}>{pickup.name}<span>{[pickup.city, pickup.pincode].filter(Boolean).join(' ') || 'Bangalore'}</span></strong>)}</div></div>
        <div><span className="route-dot drop" /><div><small>DROP</small><strong>{[order.dropArea.city, order.dropArea.pincode].filter(Boolean).join(' ')}</strong></div></div>
      </div>
      <div className={`payment-banner ${order.cashToCollect ? 'is-cash' : 'is-prepaid'}`}><IndianRupee size={18} />{order.cashToCollect ? <span><b>Collect {rupees(order.cashToCollect)}</b> at the door</span> : <span><b>Prepaid</b> · no cash to collect</span>}</div>
      <footer className="job-foot">
        {cardErrors[order._id] && <p className="form-error" role="alert">{cardErrors[order._id]}</p>}
        <button className="primary-button" type="button" disabled={working || atCapacity} onClick={() => void acceptOrder(order)}><Hand size={18} /> {working ? 'Accepting…' : 'Accept order'}</button>
      </footer>
    </article>
  }

  const renderAction = (delivery: Delivery) => {
    const working = Boolean(busy[delivery._id])
    const release = <button className="secondary-button" type="button" disabled={working} onClick={() => void releaseOrder(delivery)}><Undo2 size={16} /> Release order</button>
    if (delivery.status === 'placed') return <><p className="waiting"><Clock3 size={16} /> The seller is still packing this order. You can pick it up once it is marked packed.</p>{release}</>
    if (delivery.status === 'packed') {
      const remaining = delivery.pickups.filter((pickup) => !pickup.pickedUpAt).length
      return <><p className="waiting"><PackageCheck size={16} /> {remaining === delivery.pickups.length ? 'At the pickup, ask the seller for their 4-digit pickup code and enter it above.' : `Collect from ${remaining} more seller${remaining === 1 ? '' : 's'} to finish the pickup.`}</p>{remaining === delivery.pickups.length && release}</>
    }
    if (delivery.status === 'shipped') return <button className="primary-button" type="button" disabled={working} onClick={() => void advance(delivery, 'out_for_delivery')}><Truck size={18} /> {working ? 'Updating…' : 'Start delivery'}</button>
    const otp = otps[delivery._id] || ''
    return <form className="otp-form" onSubmit={(event) => { event.preventDefault(); void advance(delivery, 'delivered') }}>
      <label><span>Customer’s delivery OTP</span><small>Ask the customer for the 4-digit code we sent them by SMS. Only hand over the parcel once it is accepted.</small>
        <input inputMode="numeric" autoComplete="one-time-code" maxLength={4} placeholder="• • • •" aria-label={`Delivery OTP for order ${orderNumber(delivery._id)}`} value={otp} onChange={(event) => setOtps((current) => ({ ...current, [delivery._id]: event.target.value.replace(/\D/g, '').slice(0, 4) }))} />
      </label>
      <button className="primary-button success" type="submit" disabled={working || otp.length !== 4}><CircleCheck size={18} /> {working ? 'Checking…' : 'Confirm delivery'}</button>
    </form>
  }

  const renderDelivery = (delivery: Delivery) => {
    const stageIndex = stages.indexOf(delivery.status)
    const pickedUp = ['shipped', 'out_for_delivery'].includes(delivery.status)
    return <article className={`job-card is-${delivery.status}`} key={delivery._id}>
      <header className="job-head">
        <div><strong>Order #{orderNumber(delivery._id)}</strong><small>Accepted {time(delivery.assignedAt || delivery.createdAt)} · {delivery.itemCount} item{delivery.itemCount === 1 ? '' : 's'}</small></div>
        <span className={`stage-chip is-${delivery.status}`}>{stageLabels[delivery.status]}</span>
      </header>
      <ol className="job-progress" aria-label="Delivery progress">{stages.map((stage, index) => <li className={index <= stageIndex ? 'done' : ''} key={stage}><i />{stage === 'packed' ? 'Packed' : stageLabels[stage]}</li>)}</ol>
      <div className={`payment-banner ${delivery.cashToCollect ? 'is-cash' : 'is-prepaid'}`}>
        <IndianRupee size={18} />
        {delivery.cashToCollect ? <span><b>Collect {rupees(delivery.cashToCollect)}</b> in cash or UPI at the door</span> : <span><b>Prepaid</b> · do not collect any money</span>}
      </div>
      <section className={`stop ${pickedUp ? 'is-done' : ''}`}>
        <span className="stop-icon"><Store size={17} /></span>
        <div className="stop-body">
          <span className="stop-label">PICK UP{delivery.pickups.length > 1 ? ` · ${delivery.pickups.length} SELLERS` : ''}</span>
          {delivery.pickups.map((pickup) => <div className="stop-place" key={pickup.sellerId}>
            <strong>{pickup.name}</strong>
            <p>{addressText(pickup) || 'Pickup address not on file. Call the seller.'}</p>
            <ul>{pickup.items.map((item) => <li key={item._id}>{item.name}{item.size && item.size !== 'One size' ? ` · ${item.size}` : ''} × {item.quantity}</li>)}</ul>
            <div className="stop-actions">{pickup.phone && <a href={`tel:${pickup.phone}`}><Phone size={15} /> Call seller</a>}{addressText(pickup) && <a href={mapsLink(pickup)} target="_blank" rel="noreferrer"><Navigation size={15} /> Directions</a>}</div>
            {pickup.pickedUpAt
              ? <p className="collected"><CircleCheck size={15} /> Collected {time(pickup.pickedUpAt)}</p>
              : delivery.status === 'packed' && <form className="pickup-form" onSubmit={(event) => { event.preventDefault(); void confirmPickup(delivery, pickup) }}>
                <input inputMode="numeric" autoComplete="one-time-code" maxLength={4} placeholder="Pickup code" aria-label={`Pickup code from ${pickup.name}`} value={otps[pickupKey(delivery, pickup)] || ''} onChange={(event) => setOtps((current) => ({ ...current, [pickupKey(delivery, pickup)]: event.target.value.replace(/\D/g, '').slice(0, 4) }))} />
                <button className="primary-button" type="submit" disabled={Boolean(busy[delivery._id]) || (otps[pickupKey(delivery, pickup)] || '').length !== 4}><PackageCheck size={17} /> Confirm pickup</button>
              </form>}
          </div>)}
        </div>
      </section>
      <section className="stop">
        <span className="stop-icon drop"><MapPin size={17} /></span>
        <div className="stop-body">
          <span className="stop-label">DELIVER TO{delivery.address.type ? ` · ${delivery.address.type.toUpperCase()}` : ''}</span>
          <div className="stop-place">
            <strong>{delivery.customer.name}</strong>
            <p>{addressText(delivery.address)}</p>
            <div className="stop-actions">{delivery.customer.phone && <a href={`tel:${delivery.customer.phone}`}><Phone size={15} /> Call customer</a>}<a href={mapsLink(delivery.address)} target="_blank" rel="noreferrer"><Navigation size={15} /> Directions</a></div>
          </div>
        </div>
      </section>
      <footer className="job-foot">
        {cardErrors[delivery._id] && <p className="form-error" role="alert">{cardErrors[delivery._id]}</p>}
        {renderAction(delivery)}
      </footer>
    </article>
  }

  const renderAvailableReturn = (job: AvailableReturn) => {
    const working = Boolean(busy[job._id])
    return <article className="job-card offer-card return-job" key={job._id}>
      <header className="job-head">
        <div><strong>Return · order #{orderNumber(job.orderId)}</strong><small>{job.requestedAt ? `Accepted by seller ${minutesAgo(job.requestedAt)} · ` : ''}{job.itemCount} item{job.itemCount === 1 ? '' : 's'}</small></div>
        <span className="stage-chip is-return">Return pickup</span>
      </header>
      <div className="route">
        <div><span className="route-dot pickup" /><div><small>PICK UP FROM CUSTOMER</small><strong>{[job.pickupArea.city, job.pickupArea.pincode].filter(Boolean).join(' ') || 'Bangalore'}</strong></div></div>
        <div><span className="route-dot drop" /><div><small>RETURN TO SELLER</small><strong>{job.seller.name}<span>{[job.seller.city, job.seller.pincode].filter(Boolean).join(' ') || 'Bangalore'}</span></strong></div></div>
      </div>
      <div className="payment-banner is-prepaid"><Undo2 size={18} /><span><b>No cash</b> · collect the item and bring it back</span></div>
      <footer className="job-foot">
        {cardErrors[job._id] && <p className="form-error" role="alert">{cardErrors[job._id]}</p>}
        <button className="primary-button" type="button" disabled={working || atCapacity} onClick={() => void acceptReturn(job)}><Hand size={18} /> {working ? 'Accepting…' : 'Accept return pickup'}</button>
      </footer>
    </article>
  }

  const renderReturnJob = (job: ReturnJob) => {
    const working = Boolean(busy[job._id])
    const collected = job.status !== 'assigned'
    const otp = otps[job._id] || ''
    return <article className={`job-card return-job is-${job.status}`} key={job._id}>
      <header className="job-head">
        <div><strong>Return · order #{orderNumber(job.orderId)}</strong><small>Accepted {time(job.assignedAt)} · {job.itemCount} item{job.itemCount === 1 ? '' : 's'}</small></div>
        <span className="stage-chip is-return">{returnLabels[job.status]}</span>
      </header>
      <section className={`stop ${collected ? 'is-done' : ''}`}>
        <span className="stop-icon drop"><MapPin size={17} /></span>
        <div className="stop-body">
          <span className="stop-label">COLLECT FROM CUSTOMER{job.address.type ? ` · ${job.address.type.toUpperCase()}` : ''}</span>
          <div className="stop-place">
            <strong>{job.customer.name}</strong>
            <p>{addressText(job.address)}</p>
            <ul>{job.items.map((item) => <li key={item._id}>{item.name}{item.size && item.size !== 'One size' ? ` · ${item.size}` : ''} × {item.quantity}</li>)}</ul>
            <div className="stop-actions">{job.customer.phone && <a href={`tel:${job.customer.phone}`}><Phone size={15} /> Call customer</a>}<a href={mapsLink(job.address)} target="_blank" rel="noreferrer"><Navigation size={15} /> Directions</a></div>
            {job.pickedUpAt && <p className="collected"><CircleCheck size={15} /> Collected {time(job.pickedUpAt)}</p>}
          </div>
        </div>
      </section>
      <section className="stop">
        <span className="stop-icon"><Store size={17} /></span>
        <div className="stop-body">
          <span className="stop-label">RETURN TO SELLER</span>
          <div className="stop-place">
            <strong>{job.seller.name}</strong>
            <p>{addressText(job.seller) || 'Seller address not on file. Call the seller.'}</p>
            <div className="stop-actions">{job.seller.phone && <a href={`tel:${job.seller.phone}`}><Phone size={15} /> Call seller</a>}{addressText(job.seller) && <a href={mapsLink(job.seller)} target="_blank" rel="noreferrer"><Navigation size={15} /> Directions</a>}</div>
          </div>
        </div>
      </section>
      <footer className="job-foot">
        {cardErrors[job._id] && <p className="form-error" role="alert">{cardErrors[job._id]}</p>}
        <form className="otp-form" onSubmit={(event) => { event.preventDefault(); void advanceReturn(job) }}>
          <label><span>{collected ? 'Seller’s return code' : 'Customer’s return code'}</span><small>{collected ? 'Hand the items to the seller and ask for the 4-digit return code we sent them by SMS.' : 'Check the items, then ask the customer for the 4-digit return code we sent them by SMS.'}</small>
            <input inputMode="numeric" autoComplete="one-time-code" maxLength={4} placeholder="• • • •" aria-label={`Return code for order ${orderNumber(job.orderId)}`} value={otp} onChange={(event) => setOtps((current) => ({ ...current, [job._id]: event.target.value.replace(/\D/g, '').slice(0, 4) }))} />
          </label>
          <button className="primary-button success" type="submit" disabled={working || otp.length !== 4}><CircleCheck size={18} /> {working ? 'Checking…' : collected ? 'Confirm returned to seller' : 'Confirm collected'}</button>
        </form>
        {!collected && <button className="secondary-button" type="button" disabled={working} onClick={() => void releaseReturn(job)}><Undo2 size={16} /> Release return pickup</button>}
      </footer>
    </article>
  }

  return (
    <div className="app-shell">
      {topbar}
      <main className="content">
        <section className="greeting">
          <div><span className="eyebrow">{new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' }).toUpperCase()}</span><h1>Hi, {partner.name.split(' ')[0]}</h1></div>
          <span className="vehicle"><Bike size={15} /> {partner.vehicleType}{partner.vehicleNumber ? ` · ${partner.vehicleNumber}` : ''}</span>
        </section>
        <section className="stats" aria-label="Today at a glance">
          <div><strong>{openJobs}<small>/{maxOpenJobs}</small></strong><span>My open jobs</span></div>
          <div><strong>{deliveredToday.length + returnedToday.length}</strong><span>Done today</span></div>
          <div><strong>{rupees(cashDue)}</strong><span>Cash to collect</span></div>
        </section>

        <nav className="tabs" role="tablist">
          <button role="tab" aria-selected={tab === 'available'} className={tab === 'available' ? 'active' : ''} type="button" onClick={() => setTab('available')}>Available <b>{available.length + returns.available.length}</b></button>
          <button role="tab" aria-selected={tab === 'active'} className={tab === 'active' ? 'active' : ''} type="button" onClick={() => setTab('active')}>My jobs <b>{openJobs}</b></button>
          <button role="tab" aria-selected={tab === 'completed'} className={tab === 'completed' ? 'active' : ''} type="button" onClick={() => setTab('completed')}>Done</button>
          <button role="tab" aria-selected={tab === 'account'} className={tab === 'account' ? 'active' : ''} type="button" onClick={() => setTab('account')} aria-label="Account"><UserRound size={16} /></button>
        </nav>

        {loadError && <p className="banner-error" role="alert">{loadError}</p>}

        {tab === 'available' && <>
          {atCapacity && <p className="banner-info">You have {openJobs} open jobs, the most you can hold at once. Finish or release one to accept more.</p>}
          {available.length || returns.available.length
            ? <div className="job-list">{available.map(renderAvailable)}{returns.available.map(renderAvailableReturn)}</div>
            : <div className="empty"><span><Package size={26} /></span><h2>{loading && !lastUpdated ? 'Looking for orders…' : 'No orders waiting right now'}</h2><p>Orders appear here as soon as the seller packs them, and return pickups once a seller accepts a return. This page refreshes every 30 seconds.</p></div>}
        </>}

        {tab === 'active' && (openJobs
          ? <div className="job-list">{active.map(renderDelivery)}{returns.active.map(renderReturnJob)}</div>
          : <div className="empty"><span><Truck size={26} /></span><h2>No jobs yet</h2><p>Accept an order from the Available tab and it shows up here with the pickup and drop details.</p><button className="secondary-button" type="button" onClick={() => setTab('available')}>See available orders</button></div>)}

        {tab === 'completed' && (completed.length || returns.completed.length
          ? <section className="completed">
            <div className="completed-summary"><span>Last 30 days</span><span>Cash collected today <b>{rupees(cashCollectedToday)}</b></span></div>
            <ul>{completed.map((delivery) => <li key={delivery._id}>
              <span className="done-icon"><CircleCheck size={18} /></span>
              <div><strong>#{orderNumber(delivery._id)} · {delivery.customer.name}</strong><small>{delivery.address.city} {delivery.address.pincode} · {time(delivery.deliveredAt)}</small></div>
              <b>{delivery.cashCollected ? `${rupees(delivery.cashCollected)} cash` : 'Prepaid'}</b>
            </li>)}</ul>
            {returns.completed.length > 0 && <>
              <div className="completed-summary"><span>Returns brought back</span><span><b>{returns.completed.length}</b></span></div>
              <ul>{returns.completed.map((job) => <li key={job._id}>
                <span className="done-icon"><Undo2 size={18} /></span>
                <div><strong>#{orderNumber(job.orderId)} · {job.customer.name} → {job.seller.name}</strong><small>{job.itemCount} item{job.itemCount === 1 ? '' : 's'} · {time(job.returnedAt)}</small></div>
                <b>Return</b>
              </li>)}</ul>
            </>}
          </section>
          : <div className="empty"><span><CircleCheck size={26} /></span><h2>No completed deliveries yet</h2><p>Orders you deliver in the last 30 days are listed here.</p></div>)}

        {tab === 'account' && <section className="account">
          <div className="profile-card">
            <span className="avatar"><UserRound size={22} /></span>
            <div><strong>{partner.name}</strong><small>{partner.phone} · {partner.email}</small><small>{partner.vehicleType}{partner.vehicleNumber ? ` · ${partner.vehicleNumber}` : ''}{partner.area ? ` · ${partner.area}` : ''}</small></div>
          </div>
          <form className="password-form" onSubmit={changePassword}>
            <h2><KeyRound size={17} /> Change password</h2>
            <label className="field"><span>Current password</span><input type="password" autoComplete="current-password" value={passwordDraft.current} onChange={(event) => setPasswordDraft({ ...passwordDraft, current: event.target.value })} required /></label>
            <label className="field"><span>New password</span><input type="password" autoComplete="new-password" minLength={8} value={passwordDraft.next} onChange={(event) => setPasswordDraft({ ...passwordDraft, next: event.target.value })} required /></label>
            <label className="field"><span>Confirm new password</span><input type="password" autoComplete="new-password" minLength={8} value={passwordDraft.confirm} onChange={(event) => setPasswordDraft({ ...passwordDraft, confirm: event.target.value })} required /></label>
            {passwordMessage && <p className={passwordMessage.ok ? 'form-success' : 'form-error'} role="status">{passwordMessage.text}</p>}
            <button className="primary-button" type="submit">Update password</button>
          </form>
        </section>}

        {lastUpdated && tab !== 'account' && <p className="updated">Updated {lastUpdated.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })}</p>}
      </main>
      {notice && <div className="toast" role="status">{notice}</div>}
    </div>
  )
}

export default DeliveryApp
