import { useEffect, useState } from 'react'
import * as authApi from '../api/auth'
import { useStore } from '../context/StoreContext'
import { formatPrice } from '../utils/format'
import { indianMobileMessage, mobileError, normalizeIndianMobile } from '../utils/mobile'

// Login (password or one-time code) and sign-up. Customers sign in with their email address (at CUSTOMER_EMAIL_DOMAIN,
// gmail.com by default) or their mobile number.
function LoginPage() {
  const { showNotice, finishAuth, shopSettings } = useStore()
  const emailDomain = shopSettings.customerEmailDomain
  const emailLabel = emailDomain === 'gmail.com' ? 'Gmail address' : `@${emailDomain} email address`
  const isShopEmail = (value) => /^[^\s@]+@[^\s@]+$/.test(value) && value.toLowerCase().endsWith(`@${emailDomain}`)
  const [authMode, setAuthMode] = useState('login')
  const [authEmail, setAuthEmail] = useState('')
  const [authIdentifier, setAuthIdentifier] = useState('')
  const [authPhone, setAuthPhone] = useState('')
  const [authName, setAuthName] = useState('')
  const [authPassword, setAuthPassword] = useState('')
  // OTP: login with a code instead of a password, and mobile verification at sign-up.
  const [otpConfig, setOtpConfig] = useState({ signupOtp: false, loginOtpPhone: false, loginOtpEmail: false })
  const [loginMethod, setLoginMethod] = useState('password')
  const [otpSentTo, setOtpSentTo] = useState('')
  const [otpCode, setOtpCode] = useState('')
  const [otpBusy, setOtpBusy] = useState(false)

  useEffect(() => {
    authApi.fetchOtpConfig().then(setOtpConfig).catch(() => undefined)
  }, [])

  const resetOtp = () => { setOtpSentTo(''); setOtpCode('') }
  const switchAuthMode = (mode) => { setAuthMode(mode); resetOtp() }
  const signedIn = (user) => { resetOtp(); finishAuth(user) }

  const usingEmail = authIdentifier.includes('@')
  const loginIdentifier = () => usingEmail ? authIdentifier.trim() : normalizeIndianMobile(authIdentifier)
  const checkIdentifier = () => {
    if (usingEmail && !isShopEmail(authIdentifier.trim())) { showNotice(`Enter your ${emailLabel}`); return false }
    if (!usingEmail && !normalizeIndianMobile(authIdentifier)) { showNotice(indianMobileMessage); return false }
    return true
  }
  const sendAuthOtp = async () => {
    if (!checkIdentifier()) return
    setOtpBusy(true)
    const { ok, result } = await authApi.sendLoginCode(loginIdentifier())
    setOtpBusy(false)
    showNotice(result.message || (ok ? 'Code sent' : 'Could not send the code'))
    if (ok) { setOtpSentTo(String(loginIdentifier())); setOtpCode('') }
  }

  // Sign-up verifies the mobile number by SMS when SMS is configured; the email address is not verified.
  const signupPhone = normalizeIndianMobile(authPhone) || ''
  const signupEmail = authEmail.trim().toLowerCase()
  const phoneCodePending = otpConfig.signupOtp && otpSentTo !== signupPhone
  const showPhoneCode = otpConfig.signupOtp && Boolean(otpSentTo) && otpSentTo === signupPhone
  const sendSignupCode = async () => {
    setOtpBusy(true)
    const { ok, result } = await authApi.sendSignupCode(signupPhone)
    setOtpBusy(false)
    showNotice(result.message || (ok ? 'Code sent.' : 'Could not send the code.'))
    if (ok) { setOtpSentTo(signupPhone); setOtpCode('') }
  }

  const submitAuth = async (event) => {
    event.preventDefault()
    if (authMode === 'login' && loginMethod === 'otp') {
      if (!otpSentTo) { await sendAuthOtp(); return }
      const { ok, result } = await authApi.verifyLoginCode(loginIdentifier(), otpCode)
      if (!ok) { showNotice(result.message || 'Could not sign in'); return }
      signedIn(result.user)
      return
    }
    if (authMode === 'login') {
      if (!checkIdentifier()) return
    } else {
      if (!isShopEmail(signupEmail)) { showNotice(`Use a${/^[aeiou]/i.test(emailLabel) ? 'n' : ''} ${emailLabel}`); return }
      if (!signupPhone) { showNotice(indianMobileMessage); return }
      if (phoneCodePending) { await sendSignupCode(); return }
    }
    const { ok, result } = authMode === 'login'
      ? await authApi.login(loginIdentifier(), authPassword)
      : await authApi.register({ name: authName, email: signupEmail, phone: signupPhone, password: authPassword, otp: otpCode })
    if (!ok) { showNotice(result.message || 'Could not sign in'); return }
    signedIn(result.user)
  }

  const submitLabel = otpBusy ? 'Sending code…'
    : authMode === 'login' ? (loginMethod === 'otp' ? (otpSentTo ? 'Verify & login' : 'Send login code') : 'Continue')
    : phoneCodePending ? 'Verify mobile number' : 'Create account'

  return <section className="auth-page">
    <div className="auth-card">
      <div className="auth-banner"><span>Free delivery</span><strong>on orders above {formatPrice(shopSettings.freeDeliveryFrom)}</strong><small>{shopSettings.returnWindowDays} day easy returns · Cash on delivery</small></div>
      <div className="auth-body">
        <h1>{authMode === 'login' ? <><b>Login</b> to your account</> : <><b>Signup</b> for a new account</>}</h1>
        {authMode === 'login' && (otpConfig.loginOtpPhone || otpConfig.loginOtpEmail) && <div className="auth-method" role="tablist"><button role="tab" aria-selected={loginMethod === 'password'} className={loginMethod === 'password' ? 'active' : ''} type="button" onClick={() => { setLoginMethod('password'); setOtpSentTo('') }}>Password</button><button role="tab" aria-selected={loginMethod === 'otp'} className={loginMethod === 'otp' ? 'active' : ''} type="button" onClick={() => setLoginMethod('otp')}>One-time code</button></div>}
        <form className="auth-form" onSubmit={submitAuth}>
          {authMode === 'register' && <label className="field"><span>Full name</span><input value={authName} onChange={(event) => setAuthName(event.target.value)} required /></label>}
          {authMode === 'login'
            ? <label className="field"><span>{emailLabel[0].toUpperCase() + emailLabel.slice(1)} or mobile number</span><input value={authIdentifier} onChange={(event) => { setAuthIdentifier(event.target.value); if (otpSentTo) setOtpSentTo('') }} placeholder={`you@${emailDomain} or 98XXXXXXXX`} autoComplete="username" required aria-invalid={Boolean(!usingEmail && mobileError(authIdentifier))} />{!usingEmail && mobileError(authIdentifier) && <small className="field-error">{mobileError(authIdentifier)}</small>}</label>
            : <label className="field"><span>{emailLabel[0].toUpperCase() + emailLabel.slice(1)}</span><input type="email" value={authEmail} onChange={(event) => setAuthEmail(event.target.value)} placeholder={`you@${emailDomain}`} required /></label>}
          {authMode === 'register' && <label className="field field-phone"><span>Mobile number</span><div><b>+91</b><input type="tel" inputMode="numeric" autoComplete="tel-national" value={authPhone} onChange={(event) => setAuthPhone(event.target.value.replace(/\D/g, '').slice(0, 10))} placeholder="10-digit mobile number" required aria-invalid={Boolean(mobileError(authPhone))} /></div>{mobileError(authPhone) && <small className="field-error">{mobileError(authPhone)}</small>}</label>}
          {!(authMode === 'login' && loginMethod === 'otp') && <label className="field"><span>Password</span><input type="password" value={authPassword} onChange={(event) => setAuthPassword(event.target.value)} minLength={shopSettings.customerPasswordMinLength} required /></label>}
          {otpSentTo && (authMode === 'login' ? loginMethod === 'otp' : showPhoneCode) && <label className="field otp-field"><span>{authMode === 'login' ? 'Login code' : 'Mobile verification code'}</span><input inputMode="numeric" autoComplete="one-time-code" maxLength={6} placeholder="6-digit code" value={otpCode} onChange={(event) => setOtpCode(event.target.value.replace(/\D/g, '').slice(0, 6))} required autoFocus /><small>Sent to {otpSentTo}. <button type="button" disabled={otpBusy} onClick={() => void (authMode === 'login' ? sendAuthOtp() : sendSignupCode())}>Resend code</button></small></label>}
          <button className="primary-button" type="submit" disabled={otpBusy}>{submitLabel}</button>
        </form>
        <p className="auth-switch">{authMode === 'login' ? 'New here?' : 'Already have an account?'} <button type="button" onClick={() => switchAuthMode(authMode === 'login' ? 'register' : 'login')}>{authMode === 'login' ? 'Create an account' : 'Login'}</button></p>
      </div>
    </div>
  </section>
}

export default LoginPage
