import { CircleCheck, Clock3, IndianRupee, MapPin, Navigation, PackageCheck, Phone, Store, Truck, Undo2 } from 'lucide-react'
import { useJobs } from '../context/JobsContext'
import { stageLabels, stages } from '../utils/constants'
import { addressText, itemLine, mapsLink, orderNumber, plural, rupees, time } from '../utils/format'

// What the partner can do next with an accepted order.
function DeliveryAction({ delivery }) {
  const { busy, otps, setOtp, releaseOrder, advance } = useJobs()
  const working = Boolean(busy[delivery._id])
  const release = <button className="secondary-button" type="button" disabled={working} onClick={() => void releaseOrder(delivery)}><Undo2 size={16} /> Release order</button>
  if (delivery.status === 'placed') return <><p className="waiting"><Clock3 size={16} /> The seller is still packing this order. You can pick it up once it is marked packed.</p>{release}</>
  if (delivery.status === 'packed') {
    const remaining = delivery.pickups.filter((pickup) => !pickup.pickedUpAt).length
    return <><p className="waiting"><PackageCheck size={16} /> {remaining === delivery.pickups.length ? 'At the pickup, ask the seller for their 4-digit pickup code and enter it above.' : `Collect from ${remaining} more seller${remaining === 1 ? '' : 's'} to finish the pickup.`}</p>{remaining === delivery.pickups.length && release}</>
  }
  if (delivery.status === 'shipped') return <button className="primary-button" type="button" disabled={working} onClick={() => void advance(delivery, 'out_for_delivery')}><Truck size={18} /> {working ? 'Updating…' : 'Start delivery'}</button>
  const otp = otps[delivery._id] || ''
  return <form className="otp-form" onSubmit={(event) => { event.preventDefault(); void advance(delivery, 'delivered') }}>
    <label><span>Customer’s delivery OTP</span><small>Ask the customer for the 4-digit code we sent them by SMS. Only hand over the parcel once it is accepted.</small>
      <input inputMode="numeric" autoComplete="one-time-code" maxLength={4} placeholder="• • • •" aria-label={`Delivery OTP for order ${orderNumber(delivery._id)}`} value={otp} onChange={(event) => setOtp(delivery._id, event.target.value)} />
    </label>
    <button className="primary-button success" type="submit" disabled={working || otp.length !== 4}><CircleCheck size={18} /> {working ? 'Checking…' : 'Confirm delivery'}</button>
  </form>
}

// An order the partner has accepted: where to pick it up, where to drop it, and the next step.
function DeliveryCard({ delivery }) {
  const { busy, otps, setOtp, cardErrors, pickupKey, confirmPickup } = useJobs()
  const stageIndex = stages.indexOf(delivery.status)
  const pickedUp = ['shipped', 'out_for_delivery'].includes(delivery.status)
  return <article className={`job-card is-${delivery.status}`}>
    <header className="job-head">
      <div><strong>Order #{orderNumber(delivery._id)}</strong><small>Accepted {time(delivery.assignedAt || delivery.createdAt)} · {plural(delivery.itemCount, 'item')}</small></div>
      <span className={`stage-chip is-${delivery.status}`}>{stageLabels[delivery.status]}</span>
    </header>
    <ol className="job-progress" aria-label="Delivery progress">{stages.map((stage, index) => <li className={index <= stageIndex ? 'done' : ''} key={stage}><i />{stage === 'packed' ? 'Packed' : stageLabels[stage]}</li>)}</ol>
    <div className={`payment-banner ${delivery.cashToCollect ? 'is-cash' : 'is-prepaid'}`}>
      <IndianRupee size={18} />
      {delivery.cashToCollect ? <span><b>Collect {rupees(delivery.cashToCollect)}</b> in cash or UPI at the door</span> : <span><b>Prepaid</b> · do not collect any money</span>}
    </div>
    <section className={`stop ${pickedUp ? 'is-done' : ''}`}>
      <span className="stop-icon"><Store size={17} /></span>
      <div className="stop-body">
        <span className="stop-label">PICK UP{delivery.pickups.length > 1 ? ` · ${delivery.pickups.length} SELLERS` : ''}</span>
        {delivery.pickups.map((pickup) => {
          const key = pickupKey(delivery, pickup)
          return <div className="stop-place" key={pickup.sellerId}>
            <strong>{pickup.name}</strong>
            <p>{addressText(pickup) || 'Pickup address not on file. Call the seller.'}</p>
            <ul>{pickup.items.map((item) => <li key={item._id}>{itemLine(item)}</li>)}</ul>
            <div className="stop-actions">{pickup.phone && <a href={`tel:${pickup.phone}`}><Phone size={15} /> Call seller</a>}{addressText(pickup) && <a href={mapsLink(pickup)} target="_blank" rel="noreferrer"><Navigation size={15} /> Directions</a>}</div>
            {pickup.pickedUpAt
              ? <p className="collected"><CircleCheck size={15} /> Collected {time(pickup.pickedUpAt)}</p>
              : delivery.status === 'packed' && <form className="pickup-form" onSubmit={(event) => { event.preventDefault(); void confirmPickup(delivery, pickup) }}>
                <input inputMode="numeric" autoComplete="one-time-code" maxLength={4} placeholder="Pickup code" aria-label={`Pickup code from ${pickup.name}`} value={otps[key] || ''} onChange={(event) => setOtp(key, event.target.value)} />
                <button className="primary-button" type="submit" disabled={Boolean(busy[delivery._id]) || (otps[key] || '').length !== 4}><PackageCheck size={17} /> Confirm pickup</button>
              </form>}
          </div>
        })}
      </div>
    </section>
    <section className="stop">
      <span className="stop-icon drop"><MapPin size={17} /></span>
      <div className="stop-body">
        <span className="stop-label">DELIVER TO{delivery.address.type ? ` · ${delivery.address.type.toUpperCase()}` : ''}</span>
        <div className="stop-place">
          <strong>{delivery.customer.name}</strong>
          <p>{addressText(delivery.address)}</p>
          <div className="stop-actions">{delivery.customer.phone && <a href={`tel:${delivery.customer.phone}`}><Phone size={15} /> Call customer</a>}<a href={mapsLink(delivery.address)} target="_blank" rel="noreferrer"><Navigation size={15} /> Directions</a></div>
        </div>
      </div>
    </section>
    <footer className="job-foot">
      {cardErrors[delivery._id] && <p className="form-error" role="alert">{cardErrors[delivery._id]}</p>}
      <DeliveryAction delivery={delivery} />
    </footer>
  </article>
}

export default DeliveryCard
