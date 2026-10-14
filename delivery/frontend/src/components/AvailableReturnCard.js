import { Hand, Undo2 } from 'lucide-react'
import { useJobs } from '../context/JobsContext'
import { minutesAgo, orderNumber, plural } from '../utils/format'

// A return the seller has accepted, waiting for a partner to collect it from the customer.
function AvailableReturnCard({ job }) {
  const { busy, cardErrors, atCapacity, acceptReturn } = useJobs()
  const working = Boolean(busy[job._id])
  return <article className="job-card offer-card return-job">
    <header className="job-head">
      <div><strong>Return · order #{orderNumber(job.orderId)}</strong><small>{job.requestedAt ? `Accepted by seller ${minutesAgo(job.requestedAt)} · ` : ''}{plural(job.itemCount, 'item')}</small></div>
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

export default AvailableReturnCard
