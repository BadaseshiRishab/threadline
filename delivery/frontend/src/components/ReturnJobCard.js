import { CircleCheck, MapPin, Navigation, Phone, Store, Undo2 } from 'lucide-react'
import { useJobs } from '../context/JobsContext'
import { returnLabels } from '../utils/constants'
import { addressText, itemLine, mapsLink, orderNumber, plural, time } from '../utils/format'

// A return pickup the partner has accepted: collect from the customer, then hand back to the seller.
function ReturnJobCard({ job }) {
  const { busy, otps, setOtp, cardErrors, advanceReturn, releaseReturn } = useJobs()
  const working = Boolean(busy[job._id])
  const collected = job.status !== 'assigned'
  const otp = otps[job._id] || ''
  return <article className={`job-card return-job is-${job.status}`}>
    <header className="job-head">
      <div><strong>Return · order #{orderNumber(job.orderId)}</strong><small>Accepted {time(job.assignedAt)} · {plural(job.itemCount, 'item')}</small></div>
      <span className="stage-chip is-return">{returnLabels[job.status]}</span>
    </header>
    <section className={`stop ${collected ? 'is-done' : ''}`}>
      <span className="stop-icon drop"><MapPin size={17} /></span>
      <div className="stop-body">
        <span className="stop-label">COLLECT FROM CUSTOMER{job.address.type ? ` · ${job.address.type.toUpperCase()}` : ''}</span>
        <div className="stop-place">
          <strong>{job.customer.name}</strong>
          <p>{addressText(job.address)}</p>
          <ul>{job.items.map((item) => <li key={item._id}>{itemLine(item)}</li>)}</ul>
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
          <input inputMode="numeric" autoComplete="one-time-code" maxLength={4} placeholder="• • • •" aria-label={`Return code for order ${orderNumber(job.orderId)}`} value={otp} onChange={(event) => setOtp(job._id, event.target.value)} />
        </label>
        <button className="primary-button success" type="submit" disabled={working || otp.length !== 4}><CircleCheck size={18} /> {working ? 'Checking…' : collected ? 'Confirm returned to seller' : 'Confirm collected'}</button>
      </form>
      {!collected && <button className="secondary-button" type="button" disabled={working} onClick={() => void releaseReturn(job)}><Undo2 size={16} /> Release return pickup</button>}
    </footer>
  </article>
}

export default ReturnJobCard
