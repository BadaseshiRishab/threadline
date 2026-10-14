import { Check } from 'lucide-react'
import AccountLayout from '../components/AccountLayout'
import { useStore } from '../context/StoreContext'
import { mobileError } from '../utils/mobile'

function ProfileForm() {
  const { authUser, profileDraft, setProfileDraft, saveProfile, shopSettings } = useStore()
  const latestBirthday = new Date(Date.now() - 13 * 365.25 * 24 * 3600 * 1000).toISOString().slice(0, 10)
  const update = (patch) => setProfileDraft({ ...profileDraft, ...patch })
  const alternateMobile = profileDraft.alternateMobile || ''
  return <form className="panel profile-panel" onSubmit={(event) => { event.preventDefault(); void saveProfile(profileDraft) }}>
    <h2>Edit Details</h2>
    <label className="field field-phone"><span>Mobile number</span><div><b>+91</b><input type="tel" inputMode="numeric" autoComplete="tel-national" value={profileDraft.phone} onChange={(event) => update({ phone: event.target.value.replace(/\D/g, '').slice(0, 10) })} placeholder="10-digit mobile number" aria-invalid={Boolean(mobileError(profileDraft.phone))} /></div>{mobileError(profileDraft.phone) && <small className="field-error">{mobileError(profileDraft.phone)}</small>}</label>
    <label className="field"><span>Customer ID</span><input value={authUser?.id || ''} readOnly /></label>
    <label className="field"><span>Full name</span><input value={profileDraft.name} onChange={(event) => update({ name: event.target.value })} maxLength={80} required /></label>
    <label className="field"><span>Email</span><input type="email" value={profileDraft.email} readOnly /></label>
    <div className="field"><span>Gender</span><div className="gender-picker">{['Male', 'Female', 'Other'].map((gender) => <button type="button" className={profileDraft.gender === gender ? 'selected' : ''} aria-pressed={profileDraft.gender === gender} onClick={() => update({ gender: profileDraft.gender === gender ? '' : gender })} key={gender}>{profileDraft.gender === gender && <Check size={14} />}{gender}</button>)}</div></div>
    <label className="field"><span>Birthday</span><input type="date" value={profileDraft.dateOfBirth || ''} max={latestBirthday} min="1906-01-01" onChange={(event) => update({ dateOfBirth: event.target.value })} /></label>
    <label className="field"><span>Location</span><input value={profileDraft.location || ''} onChange={(event) => update({ location: event.target.value })} maxLength={80} placeholder={`e.g. ${shopSettings.deliveryCity}`} /></label>
    <label className="field field-phone"><span>Alternate mobile</span><div><b>+91</b><input type="tel" inputMode="numeric" value={alternateMobile} onChange={(event) => update({ alternateMobile: event.target.value.replace(/\D/g, '').slice(0, 10) })} placeholder="Optional" aria-invalid={Boolean(mobileError(alternateMobile))} /></div>{mobileError(alternateMobile) && <small className="field-error">{mobileError(alternateMobile)}</small>}</label>
    <div className="form-actions"><button className="outline-button" type="button" onClick={() => setProfileDraft(null)}>Cancel</button><button className="primary-button" type="submit">Save details</button></div>
  </form>
}

function ProfilePage() {
  const { authUser, profile, profileDraft, setProfileDraft } = useStore()
  const rows = [
    ['Customer ID', authUser?.id],
    ['Full Name', profile.name],
    ['Mobile Number', profile.phone && `+91 ${profile.phone}`],
    ['Email ID', profile.email],
    ['Gender', profile.gender],
    ['Date of Birth', profile.dateOfBirth && new Date(`${profile.dateOfBirth}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })],
    ['Location', profile.location],
    ['Alternate Mobile', profile.alternateMobile && `+91 ${profile.alternateMobile}`],
  ]
  return <AccountLayout>
    {profileDraft ? <ProfileForm /> : <div className="panel profile-panel">
      <h2>Profile Details</h2>
      <dl className="profile-list">{rows.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value || <em>- not added -</em>}</dd></div>)}</dl>
      <button className="primary-button" type="button" onClick={() => setProfileDraft({ ...profile })}>Edit</button>
    </div>}
  </AccountLayout>
}

export default ProfilePage
