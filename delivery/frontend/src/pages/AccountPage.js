import { useState } from 'react'
import { KeyRound, UserRound } from 'lucide-react'
import { errorMessage } from '../api/client'
import * as deliveryApi from '../api/delivery'
import { usePartner } from '../context/PartnerContext'

const emptyPasswordDraft = { current: '', next: '', confirm: '' }

// The partner's details and a form to change their password.
function AccountPage() {
  const { partner } = usePartner()
  const [passwordDraft, setPasswordDraft] = useState(emptyPasswordDraft)
  // { ok, text } after a change is tried.
  const [passwordMessage, setPasswordMessage] = useState(null)

  const changePassword = async (event) => {
    event.preventDefault()
    if (passwordDraft.next !== passwordDraft.confirm) { setPasswordMessage({ ok: false, text: 'The new passwords do not match.' }); return }
    try {
      await deliveryApi.changePassword(passwordDraft.current, passwordDraft.next)
      setPasswordDraft(emptyPasswordDraft)
      setPasswordMessage({ ok: true, text: 'Password changed. Use it the next time you sign in.' })
    } catch (error) {
      setPasswordMessage({ ok: false, text: errorMessage(error, 'Could not change your password.') })
    }
  }

  return <section className="account">
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
  </section>
}

export default AccountPage
