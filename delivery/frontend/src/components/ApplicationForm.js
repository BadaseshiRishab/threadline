import { useState } from 'react'
import { ArrowRight } from 'lucide-react'
import { errorMessage } from '../api/client'
import * as deliveryApi from '../api/delivery'
import { usePartner } from '../context/PartnerContext'
import { documentKinds, documentTypes, emptyApplication, maxDocumentSize, vehicleTypes } from '../utils/constants'

// Applying to deliver, or (resubmitting) correcting a rejected application. onSubmitted runs once it is accepted.
function ApplicationForm({ resubmitting, initialApplication = emptyApplication, onSubmitted }) {
  const { partner, setPartner, otpConfig, showNotice } = usePartner()
  const [application, setApplication] = useState(initialApplication)
  const [documents, setDocuments] = useState({})
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [otpSentTo, setOtpSentTo] = useState('')
  const [otpCode, setOtpCode] = useState('')
  const [otpBusy, setOtpBusy] = useState(false)
  const bicycle = application.vehicleType === 'Bicycle'
  const update = (patch) => setApplication({ ...application, ...patch })

  // The mobile number needs a code at sign-up, and again if a rejected applicant changes it. The email is not verified.
  const phoneNeedsCode = otpConfig.signupOtp && (!partner || application.phone !== partner.phone)
  const phoneCodePending = phoneNeedsCode && otpSentTo !== application.phone

  const sendCode = async () => {
    setOtpBusy(true)
    setError('')
    try {
      const result = await deliveryApi.sendSignupCode(application.phone)
      setOtpSentTo(application.phone)
      setOtpCode('')
      showNotice(result.message)
    } catch (sendError) {
      setError(errorMessage(sendError, 'Could not send the code.'))
    } finally {
      setOtpBusy(false)
    }
  }

  const chooseDocument = (kind, file, input) => {
    if (file && (!documentTypes.includes(file.type) || file.size > maxDocumentSize)) {
      input.value = ''
      setError('Each document must be a JPEG, PNG or PDF under 5 MB.')
      file = undefined
    } else setError('')
    setDocuments((current) => ({ ...current, [kind]: file }))
  }

  const submit = async (event) => {
    event.preventDefault()
    if (phoneCodePending) {
      if (!/^[6-9]\d{9}$/.test(application.phone)) { setError('Enter a valid 10-digit Indian mobile number.'); return }
      await sendCode()
      return
    }
    const missingDocument = !bicycle && documentKinds.find(({ kind }) => !documents[kind] && !partner?.documents?.[kind])
    if (missingDocument) { setError(`Upload your ${missingDocument.label.toLowerCase()}.`); return }
    setSubmitting(true)
    setError('')
    try {
      const body = new FormData()
      for (const [key, value] of Object.entries({ ...application, otp: otpCode })) body.append(key, value)
      for (const { kind, field } of documentKinds) if (documents[kind]) body.append(field, documents[kind])
      const result = resubmitting ? await deliveryApi.resubmitApplication(body) : await deliveryApi.apply(body)
      setPartner(result.partner)
      onSubmitted?.()
      if (resubmitting) showNotice('Application resubmitted')
    } catch (submitError) {
      setError(errorMessage(submitError, 'Could not submit your application.'))
    } finally {
      setSubmitting(false)
    }
  }

  return <form className="application-form" onSubmit={submit}>
    <label className="field"><span>Full name</span><input autoComplete="name" value={application.name} maxLength={80} onChange={(event) => update({ name: event.target.value })} required /></label>
    <label className="field"><span>Mobile number</span><input autoComplete="tel" inputMode="numeric" maxLength={10} placeholder="10-digit mobile" value={application.phone} onChange={(event) => update({ phone: event.target.value.replace(/\D/g, '').slice(0, 10) })} required /></label>
    <label className="field wide"><span>Email</span><input type="email" autoComplete="email" value={application.email} onChange={(event) => update({ email: event.target.value })} required /></label>
    {!resubmitting && <label className="field wide"><span>Create a password</span><input type="password" autoComplete="new-password" minLength={8} placeholder="At least 8 characters" value={application.password} onChange={(event) => update({ password: event.target.value })} required /></label>}
    <fieldset className="field wide vehicle-picker"><legend>Vehicle</legend><div>{vehicleTypes.map((type) => <label className={application.vehicleType === type ? 'selected' : ''} key={type}><input type="radio" name="vehicle" value={type} checked={application.vehicleType === type} onChange={() => update({ vehicleType: type })} />{type}</label>)}</div></fieldset>
    <label className="field"><span>Vehicle number{bicycle ? ' (optional)' : ''}</span><input placeholder="KA01AB1234" maxLength={14} value={application.vehicleNumber} onChange={(event) => update({ vehicleNumber: event.target.value.toUpperCase() })} required={!bicycle} /></label>
    <label className="field"><span>Driving licence{bicycle ? ' (optional)' : ''}</span><input placeholder="KA0120190001234" maxLength={20} value={application.licenceNumber} onChange={(event) => update({ licenceNumber: event.target.value.toUpperCase() })} required={!bicycle} /></label>
    {documentKinds.map(({ kind, label }) => {
      const onFile = resubmitting && partner?.documents?.[kind]
      return <label className="field document-field" key={kind}><span>{label}{bicycle ? ' (optional)' : ''}</span><input type="file" accept={documentTypes.join(',')} onChange={(event) => chooseDocument(kind, event.target.files?.[0], event.target)} required={!bicycle && !onFile && !documents[kind]} /><small>{documents[kind] ? documents[kind].name : onFile ? 'Already uploaded. Choose a file to replace it.' : 'JPEG, PNG or PDF, up to 5 MB'}</small></label>
    })}
    {phoneNeedsCode && otpSentTo === application.phone && <label className="field wide otp-field"><span>Mobile verification code</span><input inputMode="numeric" autoComplete="one-time-code" maxLength={6} placeholder="6-digit code" value={otpCode} onChange={(event) => setOtpCode(event.target.value.replace(/\D/g, '').slice(0, 6))} required autoFocus /><small>Sent to {otpSentTo}. <button className="link-button" type="button" disabled={otpBusy} onClick={() => void sendCode()}>Resend</button></small></label>}
    <label className="field wide"><span>Area you want to deliver in</span><input placeholder="e.g. Koramangala, HSR Layout" maxLength={80} value={application.area} onChange={(event) => update({ area: event.target.value })} required /></label>
    {error && <p className="form-error wide" role="alert">{error}</p>}
    <button className="primary-button wide" type="submit" disabled={submitting || otpBusy}>{otpBusy ? 'Sending code…' : submitting ? 'Submitting…' : phoneCodePending ? 'Verify mobile number' : resubmitting ? 'Resubmit application' : <>Submit application <ArrowRight size={17} /></>}</button>
  </form>
}

export default ApplicationForm
