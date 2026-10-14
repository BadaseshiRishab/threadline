import { useState } from 'react'
import { ArrowRight, Bike, ShieldCheck, Truck } from 'lucide-react'
import { errorMessage } from '../api/client'
import * as deliveryApi from '../api/delivery'
import ApplicationForm from '../components/ApplicationForm'
import { usePartner } from '../context/PartnerContext'

// Sign in (password or one-time code), or apply to become a delivery partner.
function LoginPage() {
  const { accountError, otpConfig, showNotice, signIn } = usePartner()
  const [authMode, setAuthMode] = useState('login')
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [authError, setAuthError] = useState(accountError)
  const [submitting, setSubmitting] = useState(false)
  const [loginMethod, setLoginMethod] = useState('password')
  const [otpSentTo, setOtpSentTo] = useState('')
  const [otpCode, setOtpCode] = useState('')
  const [otpBusy, setOtpBusy] = useState(false)

  const resetOtp = () => { setOtpSentTo(''); setOtpCode('') }
  const switchMode = (mode) => { setAuthMode(mode); setAuthError(''); resetOtp() }
  const codeSent = otpSentTo === identifier.trim()

  const sendLoginCode = async () => {
    setOtpBusy(true)
    setAuthError('')
    try {
      const target = identifier.trim()
      const result = await deliveryApi.sendLoginCode(target)
      setOtpSentTo(target)
      setOtpCode('')
      showNotice(result.message)
    } catch (error) {
      setAuthError(errorMessage(error, 'Could not send the code.'))
    } finally {
      setOtpBusy(false)
    }
  }

  const submit = async (event) => {
    event.preventDefault()
    if (loginMethod === 'otp' && !codeSent) { await sendLoginCode(); return }
    setSubmitting(true)
    setAuthError('')
    try {
      const result = loginMethod === 'otp' ? await deliveryApi.verifyLoginCode(identifier, otpCode) : await deliveryApi.login(identifier, password)
      signIn(result.partner)
    } catch (error) {
      setAuthError(errorMessage(error, 'Could not sign in.'))
      setSubmitting(false)
    }
  }

  return (
    <main className="login-shell">
      <section className="login-hero">
        <span className="brand-mark"><Truck size={20} /> Threadline</span>
        <h1>Deliver with<br /><em>Threadline.</em></h1>
        <p>Pick the orders you want across Bangalore, on your own schedule.</p>
      </section>
      <section className="login-card">
        <div className="auth-switch" role="tablist">
          <button role="tab" aria-selected={authMode === 'login'} className={authMode === 'login' ? 'active' : ''} type="button" onClick={() => switchMode('login')}>Sign in</button>
          <button role="tab" aria-selected={authMode === 'apply'} className={authMode === 'apply' ? 'active' : ''} type="button" onClick={() => switchMode('apply')}>Become a partner</button>
        </div>
        {authMode === 'login' ? <>
          <span className="eyebrow"><ShieldCheck size={14} /> DELIVERY PARTNER</span>
          <h2>Sign in to start your shift</h2>
          {(otpConfig.loginOtpPhone || otpConfig.loginOtpEmail) && <div className="method-switch" role="tablist"><button role="tab" aria-selected={loginMethod === 'password'} className={loginMethod === 'password' ? 'active' : ''} type="button" onClick={() => { setLoginMethod('password'); resetOtp() }}>Password</button><button role="tab" aria-selected={loginMethod === 'otp'} className={loginMethod === 'otp' ? 'active' : ''} type="button" onClick={() => setLoginMethod('otp')}>One-time code</button></div>}
          <form className="login-form" onSubmit={submit}>
            <label className="field"><span>Email or mobile number</span><input autoComplete="username" placeholder="you@example.com or 98XXXXXXXX" value={identifier} onChange={(event) => setIdentifier(event.target.value)} required /></label>
            {loginMethod === 'password'
              ? <label className="field"><span>Password</span><input type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required /></label>
              : codeSent && <label className="field otp-field"><span>Login code</span><input inputMode="numeric" autoComplete="one-time-code" maxLength={6} placeholder="6-digit code" value={otpCode} onChange={(event) => setOtpCode(event.target.value.replace(/\D/g, '').slice(0, 6))} required autoFocus /><small>Sent to {otpSentTo}. <button className="link-button" type="button" disabled={otpBusy} onClick={() => void sendLoginCode()}>Resend</button></small></label>}
            {authError && <p className="form-error" role="alert">{authError}</p>}
            <button className="primary-button" type="submit" disabled={submitting || otpBusy}>{otpBusy ? 'Sending code…' : submitting ? 'Signing in…' : loginMethod === 'otp' && !codeSent ? 'Send login code' : <>Sign in <ArrowRight size={17} /></>}</button>
          </form>
          <p className="login-note">New here? <button className="link-button" type="button" onClick={() => { setAuthMode('apply'); setAuthError('') }}>Apply to become a delivery partner</button>. Forgot your password? Ask the Threadline team to reset it.</p>
        </> : <>
          <span className="eyebrow"><Bike size={14} /> PARTNER APPLICATION</span>
          <h2>Apply to deliver</h2>
          <p className="login-lead">Tell us about you and your vehicle. Our team reviews every application, usually within a day. You can sign in to check its status.</p>
          <ApplicationForm resubmitting={false} />
        </>}
      </section>
    </main>
  )
}

export default LoginPage
