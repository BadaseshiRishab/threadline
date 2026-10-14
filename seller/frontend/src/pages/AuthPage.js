import { useState } from 'react'
import { ArrowRight, Check, CircleHelp, ShieldCheck, Sparkles } from 'lucide-react'
import { errorMessage } from '../api/client'
import * as sellerApi from '../api/seller'
import { TextField } from '../components/FormFields'
import Wordmark from '../components/Wordmark'
import { useSeller } from '../context/SellerContext'
import { ADMIN_PORTAL_URL } from '../utils/constants'

const validPhone = (phone) => /^[6-9]\d{9}$/.test(phone)

// Seller sign-up (phase 'register') and sign-in (phase 'login').
function AuthPage() {
  const { phase, setPhase, phoneOtpEnabled, startSession } = useSeller()
  const isRegistering = phase === 'register'
  const [authEmail, setAuthEmail] = useState('')
  const [authPhone, setAuthPhone] = useState('')
  const [authPassword, setAuthPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [authError, setAuthError] = useState('')
  const [phoneVerified, setPhoneVerified] = useState(false)
  const [codeSent, setCodeSent] = useState(false)
  const [phoneCode, setPhoneCode] = useState('')
  const [verificationMessage, setVerificationMessage] = useState('')

  const completeRegistration = async (event) => {
    event.preventDefault()
    if (phoneOtpEnabled && !phoneVerified) {
      setAuthError('Verify your phone number to continue.')
      return
    }
    if (authPassword !== confirmPassword) {
      setAuthError('Your passwords do not match.')
      return
    }
    try {
      await sellerApi.register({ email: authEmail.trim().toLowerCase(), phone: authPhone, password: authPassword, confirmPassword })
      setAuthEmail(authEmail.trim().toLowerCase())
      setAuthError('')
      setAuthPassword('')
      setConfirmPassword('')
      setPhase('login')
    } catch (error) {
      setAuthError(errorMessage(error, 'Could not create your account.'))
    }
  }

  const completeLogin = async (event) => {
    event.preventDefault()
    try {
      const user = await sellerApi.login(authEmail, authPassword)
      if (user.role !== 'seller') {
        await sellerApi.logout()
        setAuthError('This account does not have seller access.')
        return
      }
      await startSession(user)
    } catch (error) {
      setAuthError(errorMessage(error, 'Sign-in failed.'))
    }
  }

  const sendVerification = async () => {
    if (!validPhone(authPhone)) {
      setVerificationMessage('Enter a valid 10-digit Indian mobile number first.')
      return
    }
    try {
      const result = await sellerApi.sendPhoneCode(authPhone)
      setCodeSent(true)
      setPhoneVerified(false)
      setVerificationMessage(result.message)
      setAuthError('')
    } catch (error) {
      setAuthError(errorMessage(error, 'Could not send a verification code.'))
    }
  }

  const confirmVerification = async () => {
    try {
      const result = await sellerApi.confirmPhoneCode(authPhone, phoneCode)
      setPhoneVerified(true)
      setVerificationMessage(result.message)
      setAuthError('')
    } catch (error) {
      setAuthError(errorMessage(error, 'Could not verify that code.'))
    }
  }

  const changePhone = (event) => {
    setAuthPhone(event.target.value.replace(/\D/g, '').slice(0, 10))
    setPhoneVerified(false)
    if (phoneOtpEnabled) setCodeSent(false)
  }

  return (
    <main className="auth-shell">
      <section className="auth-visual">
        <div className="auth-visual-image" />
        <Wordmark className="wordmark wordmark-light" aria-label="Threadline home" />
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
                  <TextField label="Mobile number" type="tel" autoComplete="tel-national" placeholder="98765 43210" value={authPhone} onChange={changePhone} pattern="[6-9][0-9]{9}" title="Enter a valid 10-digit Indian mobile number" required />
                  <button className={`verify-button ${phoneVerified ? 'is-verified' : ''}`} type="button" onClick={() => void sendVerification()}>{phoneVerified ? <><Check size={14} /> Verified</> : codeSent ? 'Resend code' : 'Send code'}</button>
                </div>
                {codeSent && !phoneVerified && <div className="verification-code-row"><TextField label="Phone verification code" inputMode="numeric" autoComplete="one-time-code" placeholder="6-digit code" value={phoneCode} onChange={(event) => setPhoneCode(event.target.value.replace(/\D/g, '').slice(0, 6))} pattern="[0-9]{6}" maxLength={6} required /><button className="verify-button" type="button" onClick={() => void confirmVerification()}>Confirm</button></div>}
              </> : <>
                <TextField label="Mobile number" type="tel" autoComplete="tel-national" placeholder="98765 43210" value={authPhone} onChange={changePhone} pattern="[6-9][0-9]{9}" title="Enter a valid 10-digit Indian mobile number" required />
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

export default AuthPage
