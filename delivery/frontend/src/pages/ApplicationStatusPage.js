import { useEffect, useState } from 'react'
import { CircleX, Clock3 } from 'lucide-react'
import { documentUrl } from '../api/delivery'
import ApplicationForm from '../components/ApplicationForm'
import Toast from '../components/Toast'
import Topbar from '../components/Topbar'
import { usePartner } from '../context/PartnerContext'
import { documentKinds } from '../utils/constants'
import { time } from '../utils/format'

// For applicants: their application while it is reviewed, or why it was rejected and a way to resubmit it.
function ApplicationStatusPage() {
  const { partner, refreshMe } = usePartner()
  const [editingApplication, setEditingApplication] = useState(false)
  const rejected = partner.status === 'rejected'

  // Shows the review result without reloading.
  useEffect(() => {
    const timer = window.setInterval(() => { if (document.visibilityState === 'visible') void refreshMe() }, 60_000)
    return () => window.clearInterval(timer)
  }, [refreshMe])

  const editApplication = { name: partner.name, email: partner.email, phone: partner.phone, password: '', vehicleType: partner.vehicleType, vehicleNumber: partner.vehicleNumber, licenceNumber: partner.licenceNumber, area: partner.area }

  return <div className="app-shell">
    <Topbar onRefresh={refreshMe} />
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
        ? <section className="panel"><h2 className="panel-title">Update your application</h2><ApplicationForm resubmitting initialApplication={editApplication} onSubmitted={() => setEditingApplication(false)} /><button className="text-button" type="button" onClick={() => setEditingApplication(false)}>Cancel</button></section>
        : <section className="panel">
          <h2 className="panel-title">Your application</h2>
          <dl className="detail-list">
            <div><dt>Name</dt><dd>{partner.name}</dd></div>
            <div><dt>Mobile</dt><dd>{partner.phone}</dd></div>
            <div><dt>Email</dt><dd>{partner.email}</dd></div>
            <div><dt>Vehicle</dt><dd>{partner.vehicleType}{partner.vehicleNumber ? ` · ${partner.vehicleNumber}` : ''}</dd></div>
            <div><dt>Driving licence</dt><dd>{partner.licenceNumber || '—'}</dd></div>
            <div><dt>Documents</dt><dd>{documentKinds.filter(({ kind }) => partner.documents?.[kind]).map(({ kind }, index) => <span key={kind}>{index > 0 && ' · '}<a className="link-button" href={documentUrl(kind)} target="_blank" rel="noreferrer">{kind === 'rc' ? 'RC' : 'Licence'}</a></span>)}{!partner.documents?.licence && !partner.documents?.rc && '—'}</dd></div>
            <div><dt>Area</dt><dd>{partner.area}</dd></div>
          </dl>
          {rejected && <button className="primary-button" type="button" onClick={() => setEditingApplication(true)}>Edit and resubmit</button>}
        </section>}
    </main>
    <Toast />
  </div>
}

export default ApplicationStatusPage
