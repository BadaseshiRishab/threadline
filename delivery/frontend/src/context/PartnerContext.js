import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { ApiError } from '../api/client'
import * as deliveryApi from '../api/delivery'

const PartnerContext = createContext(null)

export function usePartner() {
  const value = useContext(PartnerContext)
  if (!value) throw new Error('usePartner must be used inside <PartnerProvider>')
  return value
}

// The signed-in delivery partner (or applicant), and the messages shown to them.
export function PartnerProvider({ children }) {
  const [partner, setPartner] = useState(null)
  const [authReady, setAuthReady] = useState(false)
  // Why the partner was signed out, e.g. a deactivated account; shown on the sign-in page.
  const [accountError, setAccountError] = useState('')
  const [otpConfig, setOtpConfig] = useState({ signupOtp: false, loginOtpPhone: false, loginOtpEmail: false })
  const [notice, setNotice] = useState('')

  const refreshMe = useCallback(async () => {
    try {
      setPartner(await deliveryApi.fetchCurrentPartner())
    } catch (error) {
      setPartner(null)
      if (error instanceof ApiError && error.status === 403) setAccountError(error.message)
    }
  }, [])

  useEffect(() => { void refreshMe().finally(() => setAuthReady(true)) }, [refreshMe])
  useEffect(() => { void deliveryApi.fetchOtpConfig().then(setOtpConfig).catch(() => undefined) }, [])

  const showNotice = (message) => {
    setNotice(message)
    window.setTimeout(() => setNotice((current) => current === message ? '' : current), 3200)
  }

  const signIn = (signedIn) => {
    setAccountError('')
    setPartner(signedIn)
  }

  const signOut = async () => {
    await deliveryApi.logout().catch(() => undefined)
    setAccountError('')
    setPartner(null)
  }

  const value = { partner, setPartner, authReady, accountError, refreshMe, otpConfig, notice, showNotice, signIn, signOut }
  return <PartnerContext.Provider value={value}>{children}</PartnerContext.Provider>
}
